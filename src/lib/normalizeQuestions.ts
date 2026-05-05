import * as turf from "@turf/turf";
import type { Feature, MultiPolygon, Polygon } from "geojson";

import { type Question, type Questions,questionsSchema } from "@/maps/schema";

import townsLevelOneAdminText from "../../matching_measuring/Towns (Level 1 admin).geojson?raw";

const PLAY_AREA_BORDER_NAME = "Play Area Border";

const TOWN_BOUNDARY_ENDPOINT_TOLERANCE = 0.00001;

const pointsAreEqual = (
    [leftLng, leftLat]: [number, number],
    [rightLng, rightLat]: [number, number],
) =>
    Math.abs(leftLng - rightLng) < TOWN_BOUNDARY_ENDPOINT_TOLERANCE &&
    Math.abs(leftLat - rightLat) < TOWN_BOUNDARY_ENDPOINT_TOLERANCE;

const stitchTownBoundaryRing = (coordinates: number[][][]) => {
    const segments = coordinates.map((line) =>
        line.map(([lng, lat]) => [lng, lat] as [number, number]),
    );
    const ring = segments.shift();

    if (!ring) {
        throw new Error("Town boundary is missing coordinates");
    }

    while (segments.length > 0) {
        const ringEnd = ring[ring.length - 1];
        const appendIndex = segments.findIndex(
            (segment) =>
                pointsAreEqual(segment[0], ringEnd) ||
                pointsAreEqual(segment[segment.length - 1], ringEnd),
        );

        if (appendIndex >= 0) {
            const segment = segments.splice(appendIndex, 1)[0];
            const orderedSegment = pointsAreEqual(
                segment[0],
                ringEnd,
            )
                ? segment
                : segment.toReversed();

            ring.push(...orderedSegment.slice(1));
            continue;
        }

        const ringStart = ring[0];
        const prependIndex = segments.findIndex(
            (segment) =>
                pointsAreEqual(segment[0], ringStart) ||
                pointsAreEqual(segment[segment.length - 1], ringStart),
        );

        if (prependIndex < 0) {
            throw new Error("Town boundary segments could not be stitched");
        }

        const segment = segments.splice(prependIndex, 1)[0];
        const orderedSegment = pointsAreEqual(segment[segment.length - 1], ringStart)
            ? segment
            : segment.toReversed();

        ring.unshift(...orderedSegment.slice(0, -1));
    }

    if (!pointsAreEqual(ring[0], ring[ring.length - 1])) {
        ring.push(ring[0]);
    }

    return ring;
};

const PLAY_AREA_BORDER_GEO = {
    type: "FeatureCollection",
    features: (
        JSON.parse(townsLevelOneAdminText) as {
            features: Array<{
                properties?: { Name?: string };
                geometry: {
                    type: "MultiLineString";
                    coordinates: number[][][];
                };
            }>;
        }
    ).features.map((feature) => {
        const polygon = turf.polygon([
            stitchTownBoundaryRing(feature.geometry.coordinates),
        ]);

        const name = feature.properties?.Name ?? "Unknown";

        return {
            type: "Feature",
            properties: {
                name,
                fixed_name: name,
            },
            geometry: polygon.geometry,
        } satisfies Feature<Polygon | MultiPolygon>;
    }),
} as const;

export const normalizeLegacyCustomZoneQuestion = (question: Question): Question => {
    if (question.id !== "matching" || question.data.type !== "custom-zone") {
        return question;
    }

    if (question.data.compiledName === PLAY_AREA_BORDER_NAME) {
        return questionsSchema.parse([
            {
                ...question,
                data: {
                    ...question.data,
                    geo: PLAY_AREA_BORDER_GEO,
                },
            },
        ])[0];
    }

    const geo = question.data.geo as
        | Feature<MultiPolygon, { collectedProperties?: Record<string, unknown>[] }>
        | undefined;
    const collectedProperties = geo?.properties?.collectedProperties;

    if (
        !geo ||
        geo.type !== "Feature" ||
        geo.geometry?.type !== "MultiPolygon" ||
        !Array.isArray(collectedProperties) ||
        collectedProperties.length !== geo.geometry.coordinates.length
    ) {
        return question;
    }

    return questionsSchema.parse([
        {
            ...question,
            data: {
                ...question.data,
                geo: {
                    type: "FeatureCollection",
                    features: geo.geometry.coordinates.map((coordinates, index) => ({
                        type: "Feature",
                        properties: collectedProperties[index] ?? {},
                        geometry: {
                            type: "Polygon",
                            coordinates,
                        },
                    })) satisfies Feature<Polygon>[],
                },
            },
        },
    ])[0];
};

export const normalizeQuestions = (questions: Questions): Questions =>
    questionsSchema.parse(
        questions.map((question: Question) =>
            normalizeLegacyCustomZoneQuestion(question),
        ),
    );
