import { describe, expect, it } from "vitest";
import * as turf from "@turf/turf";

import { normalizeLegacyCustomZoneQuestion } from "@/lib/normalizeQuestions";
import { questionsSchema } from "@/maps/schema";

describe("normalizeLegacyCustomZoneQuestion", () => {
    it("splits legacy custom-zone multipolygons into separate polygon features", () => {
        const question = questionsSchema.parse([
            {
                id: "matching",
                key: 1,
                data: {
                    type: "custom-zone",
                    lat: 0,
                    lng: 0,
                    geo: {
                        type: "Feature",
                        properties: {
                            collectedProperties: [
                                { name: "Arnhem Noord" },
                                { name: "Arnhem Zuid" },
                            ],
                        },
                        geometry: {
                            type: "MultiPolygon",
                            coordinates: [
                                [
                                    [
                                        [0, 0],
                                        [1, 0],
                                        [1, 1],
                                        [0, 0],
                                    ],
                                ],
                                [
                                    [
                                        [2, 2],
                                        [3, 2],
                                        [3, 3],
                                        [2, 2],
                                    ],
                                ],
                            ],
                        },
                    },
                },
            },
        ])[0];

        const expanded = normalizeLegacyCustomZoneQuestion(question);

        expect(expanded.data.geo).toMatchObject({
            type: "FeatureCollection",
            features: [
                {
                    properties: { name: "Arnhem Noord" },
                    geometry: { type: "Polygon" },
                },
                {
                    properties: { name: "Arnhem Zuid" },
                    geometry: { type: "Polygon" },
                },
            ],
        });
    });

    it("rebuilds the play area border preset into valid station regions", () => {
        const question = questionsSchema.parse([
            {
                id: "matching",
                key: 1,
                data: {
                    type: "custom-zone",
                    lat: 52.00567734774655,
                    lng: 5.908579297856422,
                    compiledName: "Play Area Border",
                    geo: {
                        type: "Feature",
                        properties: {},
                        geometry: {
                            type: "MultiPolygon",
                            coordinates: [],
                        },
                    },
                },
            },
        ])[0];

        const normalized = normalizeLegacyCustomZoneQuestion(question);

        expect(normalized.data.geo).toMatchObject({
            type: "FeatureCollection",
        });
        expect((normalized.data.geo as any).features.map((feature: any) => feature.properties.name)).toEqual([
            "Arnhem Noord",
            "Arnhem Zuid",
            "Oosterbeek",
            "Velp",
        ]);

        const arnhemNoord = (normalized.data.geo as any).features.find(
            (feature: any) => feature.properties.name === "Arnhem Noord",
        );
        const arnhemZuid = (normalized.data.geo as any).features.find(
            (feature: any) => feature.properties.name === "Arnhem Zuid",
        );

        expect(
            turf.booleanPointInPolygon(
                turf.point([5.9011598, 51.9844332]),
                arnhemNoord,
            ),
        ).toBe(true);
        expect(
            turf.booleanPointInPolygon(
                turf.point([5.8519491, 51.9544945]),
                arnhemNoord,
            ),
        ).toBe(false);
        expect(
            turf.booleanPointInPolygon(
                turf.point([5.8519491, 51.9544945]),
                arnhemZuid,
            ),
        ).toBe(true);
    });
});
