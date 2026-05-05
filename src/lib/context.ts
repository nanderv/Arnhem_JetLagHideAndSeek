import { persistentAtom, setPersistentEngine } from "@nanostores/persistent";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { Map } from "leaflet";
import { atom, computed, onSet } from "nanostores";

import {
    DEFAULT_GAME_AREA_LOCATION,
    DEFAULT_GAME_AREA_POLYGON,
    GAME_AREA_CONFIG_VERSION,
} from "@/lib/buildConfig";
import { normalizeQuestions } from "@/lib/normalizeQuestions";
import type {
    AdditionalMapGeoLocations,
    CustomStation,
    OpenStreetMap,
    StationCircle,
} from "@/maps/api";
import { extractStationLabel } from "@/maps/geo-utils";
import {
    type DeepPartial,
    type Question,
    type Questions,
    questionSchema,
    questionsSchema,
    type Units,
} from "@/maps/schema";

export const DEFAULT_HIDING_RADIUS = 250;
export const DEFAULT_HIDING_RADIUS_UNITS: Units = "meters";
export const DEFAULT_DISPLAY_HIDING_ZONES = true;
export const SETTINGS_CONFIG_VERSION = 2;

const isBrowser = typeof window !== "undefined";

if (!isBrowser) {
    setPersistentEngine(
        {},
        {
            addEventListener() {},
            removeEventListener() {},
        },
    );
}

export const mapGeoLocation = persistentAtom<OpenStreetMap>(
    "mapGeoLocation",
    DEFAULT_GAME_AREA_LOCATION,
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);

export const additionalMapGeoLocations = persistentAtom<
    AdditionalMapGeoLocations[]
>("additionalMapGeoLocations", [], {
    encode: JSON.stringify,
    decode: JSON.parse,
});
export const permanentOverlay = persistentAtom<FeatureCollection | null>(
    "permanentOverlay",
    null,
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);

export const mapGeoJSON = atom<FeatureCollection<
    Polygon | MultiPolygon
> | null>(null);
export const polyGeoJSON = persistentAtom<FeatureCollection<
    Polygon | MultiPolygon
> | null>("polyGeoJSON", DEFAULT_GAME_AREA_POLYGON, {
    encode: JSON.stringify,
    decode: JSON.parse,
});
const gameAreaConfigVersion = persistentAtom<number>(
    "gameAreaConfigVersion",
    0,
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);

if (isBrowser && gameAreaConfigVersion.get() !== GAME_AREA_CONFIG_VERSION) {
    mapGeoLocation.set(structuredClone(DEFAULT_GAME_AREA_LOCATION));
    polyGeoJSON.set(structuredClone(DEFAULT_GAME_AREA_POLYGON));
    gameAreaConfigVersion.set(GAME_AREA_CONFIG_VERSION);
}

export const questions = persistentAtom<Questions>("questions", [], {
    encode: JSON.stringify,
    decode: (x) => normalizeQuestions(questionsSchema.parse(JSON.parse(x))),
});
export const addQuestion = (question: DeepPartial<Question>) =>
    questionModified(questions.get().push(questionSchema.parse(question)));
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const questionModified = (..._: any[]) => {
    if (autoSave.get()) {
        questions.set([...questions.get()]);
    } else {
        triggerLocalRefresh.set(Math.random());
    }
};

export const leafletMapContext = atom<Map | null>(null);

export const defaultUnit = persistentAtom<Units>("defaultUnit", "miles");
export const hiderMode = persistentAtom<
    | false
    | {
          latitude: number;
          longitude: number;
      }
>("isHiderMode", false, {
    encode: JSON.stringify,
    decode: JSON.parse,
});
export const triggerLocalRefresh = atom<number>(0);
export const displayHidingZones = persistentAtom<boolean>(
    "displayHidingZones",
    DEFAULT_DISPLAY_HIDING_ZONES,
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
export const displayHidingZonesOptions = persistentAtom<string[]>(
    "displayHidingZonesOptions",
    ["[railway=station]"],
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
export const displayHidingZonesStyle = persistentAtom<
    "zones" | "stations" | "no-overlap" | "no-display"
>("displayHidingZonesStyle", "zones");
export const questionFinishedMapData = atom<any>(null);

export const trainStations = atom<StationCircle[]>([]);
onSet(trainStations, ({ newValue }) => {
    newValue.sort((a, b) => {
        const aName = (extractStationLabel(a.properties) || "") as string;
        const bName = (extractStationLabel(b.properties) || "") as string;
        return aName.localeCompare(bName);
    });
});

export const useCustomStations = persistentAtom<boolean>(
    "useCustomStations",
    false,
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
export const customStations = persistentAtom<CustomStation[]>(
    "customStations",
    [],
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
export const mergeDuplicates = persistentAtom<boolean>(
    "removeDuplicates",
    false,
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
export const includeDefaultStations = persistentAtom<boolean>(
    "includeDefaultStations",
    false,
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
export const animateMapMovements = persistentAtom<boolean>(
    "animateMapMovements",
    false,
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
export const hidingRadius = persistentAtom<number>(
    "hidingRadius",
    DEFAULT_HIDING_RADIUS,
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
export const hidingRadiusUnits = persistentAtom<Units>(
    "hidingRadiusUnits",
    DEFAULT_HIDING_RADIUS_UNITS,
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
const settingsConfigVersion = persistentAtom<number>(
    "settingsConfigVersion",
    0,
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);

if (isBrowser && settingsConfigVersion.get() !== SETTINGS_CONFIG_VERSION) {
    displayHidingZones.set(DEFAULT_DISPLAY_HIDING_ZONES);
    hidingRadius.set(DEFAULT_HIDING_RADIUS);
    hidingRadiusUnits.set(DEFAULT_HIDING_RADIUS_UNITS);
    settingsConfigVersion.set(SETTINGS_CONFIG_VERSION);
}
export const disabledStations = persistentAtom<string[]>(
    "disabledStations",
    [],
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
export const autoSave = persistentAtom<boolean>("autoSave", true, {
    encode: JSON.stringify,
    decode: JSON.parse,
});
export const save = () => {
    questions.set([...questions.get()]);
    const $hiderMode = hiderMode.get();

    if ($hiderMode !== false) {
        hiderMode.set({ ...$hiderMode });
    }
};

/* Presets for custom questions (savable / sharable / editable) */
export type CustomPreset = {
    id: string;
    name: string;
    type: string;
    data: any;
    createdAt: string;
};

export const customPresets = persistentAtom<CustomPreset[]>(
    "customPresets",
    [],
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
onSet(customPresets, ({ newValue }) => {
    newValue.sort((a, b) => a.name.localeCompare(b.name));
});

export const saveCustomPreset = (
    preset: Omit<CustomPreset, "id" | "createdAt">,
) => {
    const id =
        typeof crypto !== "undefined" &&
        typeof (crypto as any).randomUUID === "function"
            ? (crypto as any).randomUUID()
            : String(Date.now());
    const p: CustomPreset = {
        ...preset,
        id,
        createdAt: new Date().toISOString(),
    };
    customPresets.set([...customPresets.get(), p]);
    return p;
};

export const updateCustomPreset = (
    id: string,
    updates: Partial<CustomPreset>,
) => {
    customPresets.set(
        customPresets
            .get()
            .map((p) => (p.id === id ? { ...p, ...updates } : p)),
    );
};

export const deleteCustomPreset = (id: string) => {
    customPresets.set(customPresets.get().filter((p) => p.id !== id));
};

export const hidingZone = computed(
    [
        questions,
        polyGeoJSON,
        mapGeoLocation,
        additionalMapGeoLocations,
        disabledStations,
        hidingRadius,
        hidingRadiusUnits,
        displayHidingZonesOptions,
        useCustomStations,
        customStations,
        includeDefaultStations,
        customPresets,
        permanentOverlay,
    ],
    (
        q,
        geo,
        loc,
        altLoc,
        disabledStations,
        radius,
        hidingRadiusUnits,
        zoneOptions,
        useCustom,
        $customStations,
        includeDefault,
        presets,
        $permanentOverlay,
    ) => {
        if (geo !== null) {
            return {
                ...geo,
                questions: q,
                disabledStations: disabledStations,
                hidingRadius: radius,
                hidingRadiusUnits,
                zoneOptions: zoneOptions,
                useCustomStations: useCustom,
                customStations: $customStations,
                includeDefaultStations: includeDefault,
                presets: structuredClone(presets),
                permanentOverlay: $permanentOverlay,
            };
        } else {
            const $loc = structuredClone(loc);
            $loc.properties.isHidingZone = true;
            $loc.properties.questions = q;
            return {
                ...$loc,
                disabledStations: disabledStations,
                hidingRadius: radius,
                hidingRadiusUnits,
                alternateLocations: structuredClone(altLoc),
                zoneOptions: zoneOptions,
                useCustomStations: useCustom,
                customStations: $customStations,
                includeDefaultStations: includeDefault,
                presets: structuredClone(presets),
                permanentOverlay: $permanentOverlay,
            };
        }
    },
);

export const drawingQuestionKey = atom<number>(-1);
export const planningModeEnabled = persistentAtom<boolean>(
    "planningModeEnabled",
    false,
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
export const autoZoom = persistentAtom<boolean>("autoZoom", true, {
    encode: JSON.stringify,
    decode: JSON.parse,
});

export const isLoading = atom<boolean>(false);

export const baseTileLayer = persistentAtom<
    "voyager" | "light" | "dark" | "transport" | "neighbourhood" | "osmcarto"
>("baseTileLayer", "voyager");
export const thunderforestApiKey = persistentAtom<string>(
    "thunderforestApiKey",
    "",
    {
        encode: (value: string) => value,
        decode: (value: string) => value,
    },
);
export const followMe = persistentAtom<boolean>("followMe", false, {
    encode: JSON.stringify,
    decode: JSON.parse,
});
export const defaultCustomQuestions = persistentAtom<boolean>(
    "defaultCustomQuestions",
    false,
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);

export const pastebinApiKey = persistentAtom<string>("pastebinApiKey", "");
export const alwaysUsePastebin = persistentAtom<boolean>(
    "alwaysUsePastebin",
    false,
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);

export const showTutorial = persistentAtom<boolean>("showTutorials", true, {
    encode: JSON.stringify,
    decode: JSON.parse,
});
export const tutorialStep = atom<number>(0);

export const customInitPreference = persistentAtom<"ask" | "blank" | "prefill">(
    "customInitPreference",
    "ask",
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);

export const allowGooglePlusCodes = persistentAtom<boolean>(
    "allowGooglePlusCodes",
    false,
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);

export const matchingQuestionsOverrideUrl = persistentAtom<string>(
    "matchingQuestionsOverrideUrl",
    "",
);
export const measuringQuestionsOverrideUrl = persistentAtom<string>(
    "measuringQuestionsOverrideUrl",
    "",
);
export const overlayGeoJsonOverrideUrl = persistentAtom<string>(
    "overlayGeoJsonOverrideUrl",
    "",
);
export const hidingZonesGeoJsonOverrideUrl = persistentAtom<string>(
    "hidingZonesGeoJsonOverrideUrl",
    "",
);
