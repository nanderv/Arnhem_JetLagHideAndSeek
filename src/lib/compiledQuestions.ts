import hidingZonesGeoJsonText from "../../map_inputs/hiding_zones.geojson?raw";
import overlayGeoJsonText from "../../map_inputs/overlay.geojson?raw";

import {
    hidingZonesGeoJsonOverrideUrl,
    matchingQuestionsOverrideUrl,
    measuringQuestionsOverrideUrl,
    overlayGeoJsonOverrideUrl,
} from "@/lib/context";
import { normalizeLegacyCustomZoneQuestion, normalizeQuestions } from "@/lib/normalizeQuestions";
import { parseCustomStationsFromText, type CustomStation } from "@/maps/api";
import type { FeatureCollection, GeoJsonObject } from "geojson";

import { questionsSchema, type Question, type Questions } from "@/maps/schema";

type CompiledQuestionPreset = {
    id: string;
    name: string;
    question: Question;
};

const isAllowedCompiledQuestion = (question: Question) => {
    if (question.id === "matching") {
        return (
            question.data.type === "custom-zone" ||
            question.data.type === "custom-points"
        );
    }

    if (question.id === "measuring") {
        return question.data.type === "custom-measure";
    }

    return false;
};

const parseCompiledQuestions = (
    source: unknown,
    expectedId: Question["id"],
    fileName: string,
) => {
    const parsed = normalizeQuestions(questionsSchema.parse(source));

    if (
        parsed.some(
            (question: Question) =>
                question.id !== expectedId ||
                !isAllowedCompiledQuestion(question),
        )
    ) {
        throw new Error(
            `${fileName} must only contain custom ${expectedId} question objects`,
        );
    }

    return parsed as Questions;
};

const cloneWithFreshKeys = (questions: Questions) =>
    questionsSchema.parse(
        structuredClone(questions).map((question: Question) => ({
            ...question,
            key: Math.random(),
        })),
    );

const humanizeCompiledName = (fileName: string) =>
    fileName
        .replace(/\.json$/i, "")
        .split(/[-_]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");

const matchingQuestionModules = import.meta.glob(
    "../../map_inputs/matching/*.json",
    {
        eager: true,
        import: "default",
    },
) as Record<string, unknown>;

const measuringQuestionModules = import.meta.glob(
    "../../map_inputs/measuring/*.json",
    {
        eager: true,
        import: "default",
    },
) as Record<string, unknown>;

const parseCompiledQuestionModules = (
    modules: Record<string, unknown>,
    expectedId: Question["id"],
) => {
    return Object.entries(modules)
        .sort(([a], [b]) => a.localeCompare(b))
        .flatMap(([path, source]) =>
            parseCompiledQuestions(
                source,
                expectedId,
                path.replace(/^.*\//, ""),
            ),
        ) as Questions;
};

const parseCompiledQuestionPresets = (
    modules: Record<string, unknown>,
    expectedId: Question["id"],
) => {
    return Object.entries(modules)
        .sort(([a], [b]) => a.localeCompare(b))
        .flatMap(([path, source]) => {
            const fileName = path.replace(/^.*\//, "");
            const questions = parseCompiledQuestions(
                source,
                expectedId,
                fileName,
            );

            if (questions.length === 0) {
                return [];
            }

            const baseName = humanizeCompiledName(fileName);

            return questions.map((question: Question, index: number) => {
                const normalizedQuestion = normalizeLegacyCustomZoneQuestion(question);
                const name =
                    questions.length === 1
                        ? baseName
                        : `${baseName} ${index + 1}`;

                return {
                    id: `${fileName}:${index}`,
                    name,
                    question: questionsSchema.parse([
                        {
                            ...normalizedQuestion,
                            data: {
                                ...normalizedQuestion.data,
                                compiledName: name,
                            },
                        },
                    ])[0],
                } satisfies CompiledQuestionPreset;
            });
        });
};

const compiledMatchingPresets = parseCompiledQuestionPresets(
    matchingQuestionModules,
    "matching",
);

const compiledMatchingQuestions = questionsSchema.parse(
    compiledMatchingPresets.map((preset) => preset.question),
);

const compiledMeasuringPresets = parseCompiledQuestionPresets(
    measuringQuestionModules,
    "measuring",
);

const compiledMeasuringQuestions = questionsSchema.parse(
    compiledMeasuringPresets.map((preset) => preset.question),
);

const parseCompiledGeoJson = (source: string, fileName: string) => {
    const parsed = JSON.parse(source) as GeoJsonObject;

    if (!parsed || typeof parsed !== "object" || !("type" in parsed)) {
        throw new Error(`${fileName} must contain valid GeoJSON`);
    }

    return parsed;
};

const compiledPermanentOverlay = parseCompiledGeoJson(
    overlayGeoJsonText,
    "overlay.geojson",
);

const compiledHidingZones = parseCustomStationsFromText(
    hidingZonesGeoJsonText,
    "application/geo+json",
);

const loadOverrideText = async (url: string, fileName: string) => {
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
        throw new Error(
            `${fileName} override request failed with status ${response.status}`,
        );
    }

    return response.text();
};

const loadCompiledQuestions = async (
    overrideUrl: string,
    bundledQuestions: Questions,
    expectedId: Question["id"],
    fileName: string,
) => {
    const trimmedUrl = overrideUrl.trim();

    if (!trimmedUrl) {
        return cloneWithFreshKeys(bundledQuestions);
    }

    const text = await loadOverrideText(trimmedUrl, fileName);
    return cloneWithFreshKeys(
        parseCompiledQuestions(JSON.parse(text), expectedId, fileName),
    );
};

const loadCompiledStations = async (
    overrideUrl: string,
    bundledStations: CustomStation[],
    fileName: string,
) => {
    const trimmedUrl = overrideUrl.trim();

    if (!trimmedUrl) {
        return structuredClone(bundledStations);
    }

    const text = await loadOverrideText(trimmedUrl, fileName);
    return parseCustomStationsFromText(text, "application/geo+json");
};

const loadCompiledGeoJson = async (
    overrideUrl: string,
    bundledGeoJson: GeoJsonObject,
    fileName: string,
) => {
    const trimmedUrl = overrideUrl.trim();

    if (!trimmedUrl) {
        return structuredClone(bundledGeoJson);
    }

    const text = await loadOverrideText(trimmedUrl, fileName);
    return parseCompiledGeoJson(text, fileName);
};

export const isEmptyFeatureCollection = (geoJson: GeoJsonObject) =>
    geoJson.type === "FeatureCollection" &&
    (geoJson as FeatureCollection).features.length === 0;

export const getCompiledMatchingQuestions = () =>
    loadCompiledQuestions(
        matchingQuestionsOverrideUrl.get(),
        compiledMatchingQuestions,
        "matching",
        "map_inputs/matching",
    );

export const getCompiledMeasuringQuestions = () =>
    loadCompiledQuestions(
        measuringQuestionsOverrideUrl.get(),
        compiledMeasuringQuestions,
        "measuring",
        "map_inputs/measuring",
    );

export const getCompiledMatchingPresets = () =>
    structuredClone(compiledMatchingPresets);

export const getCompiledMeasuringPresets = () =>
    structuredClone(compiledMeasuringPresets);

export const getCompiledPermanentOverlay = () =>
    loadCompiledGeoJson(
        overlayGeoJsonOverrideUrl.get(),
        compiledPermanentOverlay,
        "overlay.geojson",
    );

export const getCompiledHidingZones = () =>
    loadCompiledStations(
        hidingZonesGeoJsonOverrideUrl.get(),
        compiledHidingZones,
        "hiding_zones.geojson",
    );
