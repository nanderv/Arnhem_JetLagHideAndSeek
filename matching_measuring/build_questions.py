#!/usr/bin/env python3

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INPUT_DIR = REPO_ROOT / "matching_measuring"
DEFAULT_MATCHING_DIR = REPO_ROOT / "map_inputs" / "matching"
DEFAULT_MEASURING_DIR = REPO_ROOT / "map_inputs" / "measuring"


def slugify_file_name(path: Path) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", path.stem.lower()).strip("-")
    return f"{slug or 'question'}.json"


def read_geojson(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as file:
        payload = json.load(file)

    if not isinstance(payload, dict) or "type" not in payload:
        raise ValueError(f"{path.name} does not contain a GeoJSON object")

    return payload


def as_feature_collection(payload: dict[str, Any]) -> dict[str, Any]:
    payload_type = payload.get("type")

    if payload_type == "FeatureCollection":
        features = payload.get("features")
        if not isinstance(features, list):
            raise ValueError("FeatureCollection is missing a features array")
        return payload

    if payload_type == "Feature":
        return {"type": "FeatureCollection", "features": [payload]}

    return {
        "type": "FeatureCollection",
        "features": [{"type": "Feature", "properties": {}, "geometry": payload}],
    }


def iter_coordinates(coordinates: Any):
    if not isinstance(coordinates, list):
        return

    if coordinates and isinstance(coordinates[0], (int, float)):
        if len(coordinates) >= 2:
            yield float(coordinates[0]), float(coordinates[1])
        return

    for item in coordinates:
        yield from iter_coordinates(item)


def geometry_bbox(geometry: dict[str, Any]) -> tuple[float, float, float, float]:
    coords = list(iter_coordinates(geometry.get("coordinates")))

    if not coords:
        raise ValueError(f"Unsupported or empty geometry: {geometry.get('type')}")

    xs = [coord[0] for coord in coords]
    ys = [coord[1] for coord in coords]
    return min(xs), min(ys), max(xs), max(ys)


def bbox_center(bbox: tuple[float, float, float, float]) -> tuple[float, float]:
    min_x, min_y, max_x, max_y = bbox
    return (min_y + max_y) / 2, (min_x + max_x) / 2


def feature_center(feature: dict[str, Any]) -> tuple[float, float]:
    return bbox_center(geometry_bbox(feature["geometry"]))


def collection_center(feature_collection: dict[str, Any]) -> tuple[float, float]:
    boxes = [geometry_bbox(feature["geometry"]) for feature in feature_collection["features"]]
    min_x = min(box[0] for box in boxes)
    min_y = min(box[1] for box in boxes)
    max_x = max(box[2] for box in boxes)
    max_y = max(box[3] for box in boxes)
    return bbox_center((min_x, min_y, max_x, max_y))


def polygon_parts(geometry: dict[str, Any]) -> list[list[list[list[float]]]]:
    geometry_type = geometry.get("type")
    coordinates = geometry.get("coordinates")

    if geometry_type == "Polygon":
        return [coordinates]
    if geometry_type == "MultiPolygon":
        return coordinates

    raise ValueError(f"Geometry type {geometry_type} cannot be used for matching zones")


def build_matching_geo(feature_collection: dict[str, Any]) -> tuple[str, Any]:
    features = feature_collection["features"]
    geometry_types = {feature["geometry"].get("type") for feature in features}

    if geometry_types.issubset({"Polygon", "MultiPolygon"}):
        coordinates: list[list[list[list[float]]]] = []
        collected_properties: list[dict[str, Any]] = []

        for feature in features:
            coordinates.extend(polygon_parts(feature["geometry"]))
            properties = feature.get("properties")
            if isinstance(properties, dict) and properties:
                collected_properties.append(properties)

        return (
            "custom-zone",
            {
                "type": "Feature",
                "properties": {"collectedProperties": collected_properties},
                "geometry": {"type": "MultiPolygon", "coordinates": coordinates},
            },
        )

    if geometry_types == {"Point"}:
        return "custom-points", features

    raise ValueError(
        "Matching questions require only Polygon/MultiPolygon or only Point geometries",
    )


def build_matching_question(feature_collection: dict[str, Any]) -> list[dict[str, Any]]:
    matching_type, matching_geo = build_matching_geo(feature_collection)
    anchor_lat, anchor_lng = feature_center(feature_collection["features"][0])

    return [
        {
            "id": "matching",
            "data": {
                "type": matching_type,
                "lat": anchor_lat,
                "lng": anchor_lng,
                "geo": matching_geo,
            },
        }
    ]


def build_measuring_question(feature_collection: dict[str, Any]) -> list[dict[str, Any]]:
    center_lat, center_lng = collection_center(feature_collection)
    return [
        {
            "id": "measuring",
            "data": {
                "type": "custom-measure",
                "lat": center_lat,
                "lng": center_lng,
                "geo": feature_collection,
            },
        }
    ]


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(payload, file, indent=2)
        file.write("\n")


def convert_file(path: Path, matching_dir: Path, measuring_dir: Path) -> None:
    payload = read_geojson(path)
    feature_collection = as_feature_collection(payload)
    file_name = slugify_file_name(path)

    matching_question = build_matching_question(feature_collection)
    measuring_question = build_measuring_question(feature_collection)

    write_json(matching_dir / file_name, matching_question)
    write_json(measuring_dir / file_name, measuring_question)

    print(f"converted {path.name} -> {file_name}")


def iter_input_files(input_dir: Path) -> list[Path]:
    return sorted(
        path
        for path in input_dir.iterdir()
        if path.is_file() and path.suffix.lower() in {".geojson", ".json"}
    )


def main() -> int:
    input_dir = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DEFAULT_INPUT_DIR
    matching_dir = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else DEFAULT_MATCHING_DIR
    measuring_dir = Path(sys.argv[3]).resolve() if len(sys.argv) > 3 else DEFAULT_MEASURING_DIR

    if not input_dir.exists():
        print(f"Input directory does not exist: {input_dir}", file=sys.stderr)
        return 1

    input_files = iter_input_files(input_dir)
    if not input_files:
        print(f"No GeoJSON or JSON files found in {input_dir}", file=sys.stderr)
        return 1

    for path in input_files:
        convert_file(path, matching_dir, measuring_dir)

    print(f"wrote matching questions to {matching_dir}")
    print(f"wrote measuring questions to {measuring_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
