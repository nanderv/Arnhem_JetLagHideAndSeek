import type { FeatureCollection, Polygon } from "geojson";

import type { OpenStreetMap } from "@/maps/api";

export const GAME_AREA_CONFIG_VERSION = 1;

export const DEFAULT_GAME_AREA_BBOX = {
    bottomLeft: {
        latitude: 51.93435,
        longitude: 5.81552,
    },
    topRight: {
        latitude: 52.01981,
        longitude: 6.00043,
    },
} as const;

const centerLatitude =
    (DEFAULT_GAME_AREA_BBOX.bottomLeft.latitude +
        DEFAULT_GAME_AREA_BBOX.topRight.latitude) /
    2;
const centerLongitude =
    (DEFAULT_GAME_AREA_BBOX.bottomLeft.longitude +
        DEFAULT_GAME_AREA_BBOX.topRight.longitude) /
    2;

export const DEFAULT_GAME_AREA_LOCATION: OpenStreetMap = {
    type: "Feature",
    geometry: {
        type: "Point",
        coordinates: [centerLatitude, centerLongitude],
    },
    properties: {
        osm_type: "R",
        osm_id: -1,
        extent: [
            DEFAULT_GAME_AREA_BBOX.bottomLeft.latitude,
            DEFAULT_GAME_AREA_BBOX.bottomLeft.longitude,
            DEFAULT_GAME_AREA_BBOX.topRight.latitude,
            DEFAULT_GAME_AREA_BBOX.topRight.longitude,
        ],
        country: "NL",
        osm_key: "place",
        countrycode: "nl",
        osm_value: "bounding_box",
        name: "Configured Game Area",
        type: "bounding_box",
    },
};

export const DEFAULT_GAME_AREA_POLYGON: FeatureCollection<Polygon> = {
    type: "FeatureCollection",
    features: [
        {
            type: "Feature",
            properties: {},
            geometry: {
                type: "Polygon",
                coordinates: [
                    [
                        [
                            DEFAULT_GAME_AREA_BBOX.bottomLeft.longitude,
                            DEFAULT_GAME_AREA_BBOX.bottomLeft.latitude,
                        ],
                        [
                            DEFAULT_GAME_AREA_BBOX.topRight.longitude,
                            DEFAULT_GAME_AREA_BBOX.bottomLeft.latitude,
                        ],
                        [
                            DEFAULT_GAME_AREA_BBOX.topRight.longitude,
                            DEFAULT_GAME_AREA_BBOX.topRight.latitude,
                        ],
                        [
                            DEFAULT_GAME_AREA_BBOX.bottomLeft.longitude,
                            DEFAULT_GAME_AREA_BBOX.topRight.latitude,
                        ],
                        [
                            DEFAULT_GAME_AREA_BBOX.bottomLeft.longitude,
                            DEFAULT_GAME_AREA_BBOX.bottomLeft.latitude,
                        ],
                    ],
                ],
            },
        },
    ],
};
