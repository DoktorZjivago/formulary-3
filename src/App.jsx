import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Search, X, Plus, Trash2, ChevronLeft, FlaskConical, Beaker,
  ArrowUpDown, Database, AlertTriangle, Copy, Pencil, Check, Loader2, User, Link as LinkIcon, Sun, Moon, Camera, Columns3, Star, Trophy
} from "lucide-react";

// ---------- Taxonomy ----------
const CHEM_CLASSES = {
  ester: { label: "Ester", color: "#B8834D" },
  lactone: { label: "Lactone", color: "#8C5A3A" },
  aldehyde: { label: "Aldehyde", color: "#7A5A8C" },
  ketone: { label: "Ketone", color: "#5A6B8C" },
  terpene: { label: "Terpene", color: "#5A6B57" },
  terpenoid: { label: "Terpenoid", color: "#4A7A5E" },
  alcohol: { label: "Alcohol", color: "#4A6B7A" },
  acid: { label: "Acid", color: "#8C3A3A" },
  phenol: { label: "Phenol", color: "#7A4A4A" },
  pyrazine: { label: "Pyrazine", color: "#6B5A3A" },
  thiol: { label: "Thiol", color: "#8C6A3A" },
  acetal: { label: "Acetal", color: "#5A5A8C" },
  furanone: { label: "Furanone", color: "#7A6B3A" },
  essentialOil: { label: "Essential oil", color: "#3E7A4E" },
  extract: { label: "Extract", color: "#2E6B5E" },
  essence: { label: "Essence", color: "#4E7A8C" },
  tincture: { label: "Tincture", color: "#7A5E3E" },
  other: { label: "Other", color: "#6B6152" },
};

const NOTE_LEVELS = {
  top: { label: "Top", color: "#C4A876", desc: "high volatility, first impression" },
  mid: { label: "Mid", color: "#B8834D", desc: "the heart, develops after top fades" },
  base: { label: "Base", color: "#7A5236", desc: "low volatility, lingers longest" },
};

const DESCRIPTOR_LIBRARY = [
  "fruity", "citrus", "tropical", "berry", "green", "floral", "rose", "jasmine",
  "creamy", "dairy", "buttery", "waxy", "fatty", "woody", "earthy", "mossy",
  "spicy", "warm", "roasted", "nutty", "smoky", "toasted", "sulfurous",
  "animalic", "musky", "herbal", "minty", "camphoraceous", "sweet", "caramel",
  "honey", "vanilla", "balsamic", "medicinal", "phenolic", "winey", "cheesy",
];

// Ethanol is the implicit carrier/solvent: every formulation totals 100%,
// with ethanol filling whatever the flavor components don't account for.
const ETHANOL = { id: "__ethanol__", name: "Ethanol (carrier)", cas: "64-17-5", class: "alcohol", note: "top", threshold: "n/a — solvent", descriptors: ["solvent"] };

function flavorTotal(components) {
  return components.reduce((s, c) => s + (parseFloat(c.dosage) || 0), 0);
}
function ethanolPct(components) {
  return Math.max(0, 100 - flavorTotal(components));
}
// Formulations are normalized to a 100 mg basis, so mg-per-100mg converts
// directly to parts-per-million: (mg / 100 mg) * 1,000,000 = dosage * 10,000.
function toPpm(mgPer100mg) {
  return mgPer100mg * 10000;
}

// A material may not be used neat — e.g. "vanillin, 10% in propylene glycol" —
// so the dosage weighed into a formulation (physical mass) and the amount of
// actual active/flavor-relevant compound it contributes can differ. Batch
// mass balance (flavorTotal/ethanolPct) always uses raw dosage, since that's
// physical weight added to the batch regardless of purity. Anywhere the app
// calculates flavor *content* — PPM, sample-amount breakdowns, beverage
// dilution — it should use this effective amount instead.
function effectiveDosage(dosage, ingredient) {
  const raw = parseFloat(dosage) || 0;
  const conc = ingredient && ingredient.concentration != null && ingredient.concentration !== ""
    ? parseFloat(ingredient.concentration)
    : 100;
  const safeConc = isNaN(conc) ? 100 : Math.min(100, Math.max(1, conc));
  return raw * (safeConc / 100);
}
function effectiveFlavorTotal(components, ingMap) {
  return components.reduce((s, c) => s + effectiveDosage(c.dosage, ingMap[c.ingId]), 0);
}

function descColor(desc) {
  const palette = ["#B8834D", "#5A6B57", "#7A5A8C", "#4A6B7A", "#8C3A3A", "#6B7A3A", "#8C5A6A"];
  let h = 0;
  for (let i = 0; i < desc.length; i++) h = desc.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}

// ---------- Seed data (used only if storage is empty) ----------
const seedIngredients = [
  { id: "i1", name: "Ethyl butyrate", altNames: ["Ethyl butanoate", "Butyric ether"], cas: "105-54-4", class: "ester", note: "top", threshold: "0.0001 ppm", avgUsage: "5 ppm", maxUsage: "20 ppm", molarMass: 116.16, concentration: 100, descriptors: ["fruity", "tropical", "green"] },
  { id: "i2", name: "Ethyl 2-methylbutyrate", altNames: ["Ethyl 2-methylbutanoate"], cas: "7452-79-1", class: "ester", note: "top", threshold: "0.0001 ppm", avgUsage: "2 ppm", maxUsage: "10 ppm", molarMass: 130.19, concentration: 100, descriptors: ["fruity", "green", "berry"] },
  { id: "i3", name: "Isoamyl acetate", altNames: ["3-Methylbutyl acetate", "Banana oil"], cas: "123-92-2", class: "ester", note: "top", threshold: "0.002 ppm", avgUsage: "3 ppm", maxUsage: "15 ppm", molarMass: 130.19, concentration: 100, descriptors: ["fruity", "tropical"] },
  { id: "i4", name: "γ-Decalactone", altNames: ["Gamma-decalactone", "4-Decanolide", "Peach Aldehyde C-14"], cas: "706-14-9", class: "lactone", note: "base", threshold: "0.011 ppm", avgUsage: "8 ppm", maxUsage: "40 ppm", molarMass: 170.25, concentration: 100, descriptors: ["creamy", "dairy", "fruity", "waxy"] },
  { id: "i5", name: "γ-Undecalactone", altNames: ["Gamma-undecalactone", "Aldehyde C-14", "Peach lactone"], cas: "104-67-6", class: "lactone", note: "base", threshold: "0.03 ppm", avgUsage: "5 ppm", maxUsage: "25 ppm", molarMass: 184.28, concentration: 100, descriptors: ["creamy", "fatty", "fruity"] },
  { id: "i6", name: "cis-3-Hexenol", altNames: ["Leaf alcohol", "(Z)-3-Hexen-1-ol"], cas: "928-96-1", class: "alcohol", note: "top", threshold: "0.00007 ppm", avgUsage: "0.5 ppm", maxUsage: "3 ppm", molarMass: 100.16, concentration: 100, descriptors: ["green", "herbal"] },
  { id: "i7", name: "Linalool", altNames: ["3,7-Dimethyl-1,6-octadien-3-ol", "Linalol"], cas: "78-70-6", class: "terpenoid", note: "mid", threshold: "0.0006 ppm", avgUsage: "1 ppm", maxUsage: "8 ppm", molarMass: 154.25, concentration: 100, descriptors: ["floral", "citrus", "green"] },
  { id: "i8", name: "Geraniol", altNames: ["(E)-3,7-Dimethyl-2,6-octadien-1-ol"], cas: "106-24-1", class: "terpenoid", note: "mid", threshold: "0.0075 ppm", avgUsage: "1 ppm", maxUsage: "6 ppm", molarMass: 154.25, concentration: 100, descriptors: ["floral", "rose", "sweet"] },
  { id: "i9", name: "Limonene (d-)", altNames: ["d-Limonene", "(R)-Limonene", "Citrene"], cas: "5989-27-5", class: "terpene", note: "top", threshold: "0.01 ppm", avgUsage: "10 ppm", maxUsage: "60 ppm", molarMass: 136.23, concentration: 100, descriptors: ["citrus", "fruity"] },
  { id: "i10", name: "Vanillin", altNames: ["4-Hydroxy-3-methoxybenzaldehyde", "Methylprotocatechuic aldehyde"], cas: "121-33-5", class: "aldehyde", note: "base", threshold: "0.02 ppm", avgUsage: "15 ppm", maxUsage: "80 ppm", molarMass: 152.15, concentration: 100, descriptors: ["sweet", "vanilla", "balsamic"] },
  { id: "i11", name: "Cinnamaldehyde", altNames: ["3-Phenyl-2-propenal", "Cinnamic aldehyde"], cas: "104-55-2", class: "aldehyde", note: "mid", threshold: "0.01 ppm", avgUsage: "4 ppm", maxUsage: "20 ppm", molarMass: 132.16, concentration: 100, descriptors: ["spicy", "warm", "woody"] },
  { id: "i12", name: "2-Acetylpyrazine", altNames: ["Methyl pyrazinyl ketone"], cas: "22047-25-2", class: "pyrazine", note: "mid", threshold: "0.001 ppm", avgUsage: "0.3 ppm", maxUsage: "2 ppm", molarMass: 122.13, concentration: 100, descriptors: ["roasted", "nutty", "toasted"] },
  { id: "i13", name: "2-Isobutyl-3-methoxypyrazine", altNames: ["IBMP", "Bell pepper pyrazine"], cas: "24683-00-9", class: "pyrazine", note: "top", threshold: "0.000002 ppm", avgUsage: "0.005 ppm", maxUsage: "0.02 ppm", molarMass: 166.22, concentration: 100, descriptors: ["green", "earthy"] },
  { id: "i14", name: "Furaneol (DMHF)", altNames: ["4-Hydroxy-2,5-dimethyl-3(2H)-furanone", "Strawberry furanone"], cas: "3658-77-3", class: "furanone", note: "mid", threshold: "0.00004 ppm", avgUsage: "1 ppm", maxUsage: "5 ppm", molarMass: 128.13, concentration: 100, descriptors: ["caramel", "sweet", "fruity"] },
  { id: "i15", name: "Diacetyl", altNames: ["Butane-2,3-dione", "Butter yellow", "2,3-Butanedione"], cas: "431-03-8", class: "ketone", note: "top", threshold: "0.00002 ppm", avgUsage: "0.5 ppm", maxUsage: "3 ppm", molarMass: 86.09, concentration: 100, descriptors: ["buttery", "creamy"] },
  { id: "i16", name: "Maltol", altNames: ["3-Hydroxy-2-methyl-4-pyrone", "Larixinic acid"], cas: "118-71-8", class: "ketone", note: "base", threshold: "0.035 ppm", avgUsage: "10 ppm", maxUsage: "50 ppm", molarMass: 126.11, concentration: 100, descriptors: ["sweet", "caramel", "roasted"] },
  { id: "i17", name: "4-Mercapto-4-methylpentan-2-one", altNames: ["MMP", "Cat ketone", "4M4MP"], cas: "19872-52-7", class: "thiol", note: "top", threshold: "0.0000001 ppm", avgUsage: "0.0005 ppm", maxUsage: "0.002 ppm", molarMass: 132.22, concentration: 100, descriptors: ["sulfurous", "tropical", "green"] },
  { id: "i18", name: "Guaiacol", altNames: ["2-Methoxyphenol"], cas: "90-05-1", class: "phenol", note: "mid", threshold: "0.003 ppm", avgUsage: "0.5 ppm", maxUsage: "3 ppm", molarMass: 124.14, concentration: 100, descriptors: ["smoky", "phenolic", "medicinal"] },
  { id: "i19", name: "Ethyl maltol", altNames: ["2-Ethyl-3-hydroxy-4-pyrone"], cas: "4940-11-8", class: "ketone", note: "base", threshold: "0.0025 ppm", avgUsage: "5 ppm", maxUsage: "25 ppm", molarMass: 140.14, concentration: 100, descriptors: ["sweet", "caramel"] },
  { id: "i20", name: "Acetaldehyde", altNames: ["Ethanal", "Acetic aldehyde"], cas: "75-07-0", class: "aldehyde", note: "top", threshold: "0.0015 ppm", avgUsage: "3 ppm", maxUsage: "15 ppm", molarMass: 44.05, concentration: 100, descriptors: ["fruity", "green"] },
  { id: "i21", name: "Benzaldehyde", altNames: ["Benzenecarbonal", "Oil of bitter almond"], cas: "100-52-7", class: "aldehyde", note: "mid", threshold: "0.35 ppm", avgUsage: "5 ppm", maxUsage: "25 ppm", molarMass: 106.12, concentration: 100, descriptors: ["nutty", "fruity", "medicinal"] },
  { id: "i22", name: "Ethyl acetal (acetaldehyde diethyl acetal)", altNames: ["1,1-Diethoxyethane", "Acetal"], cas: "105-57-7", class: "acetal", note: "top", threshold: "0.4 ppm", avgUsage: "2 ppm", maxUsage: "10 ppm", molarMass: 118.17, concentration: 100, descriptors: ["fruity", "winey", "green"] },
  { id: "i23", name: "Isovaleric acid", altNames: ["3-Methylbutanoic acid", "Isopentanoic acid"], cas: "503-74-2", class: "acid", note: "base", threshold: "0.0007 ppm", avgUsage: "0.2 ppm", maxUsage: "1.5 ppm", molarMass: 102.13, concentration: 100, descriptors: ["cheesy", "animalic", "fatty"] },
  { id: "i24", name: "Butyric acid", altNames: ["Butanoic acid", "Ethylacetic acid"], cas: "107-92-6", class: "acid", note: "base", threshold: "0.00027 ppm", avgUsage: "0.5 ppm", maxUsage: "3 ppm", molarMass: 88.11, concentration: 100, descriptors: ["cheesy", "fatty", "dairy"] },
  { id: "i25", name: "Eugenol", altNames: ["4-Allyl-2-methoxyphenol", "Clove oil constituent"], cas: "97-53-0", class: "phenol", note: "mid", threshold: "0.006 ppm", avgUsage: "2 ppm", maxUsage: "10 ppm", molarMass: 164.20, concentration: 100, descriptors: ["spicy", "woody", "phenolic"] },
];

const seedFormulations = [
  {
    id: "f1", name: "Peach Accord No. 3", subtitle: "A round, creamy stone-fruit base for dairy applications",
    author: "M. Okonkwo", authorLink: "",
    components: [{ ingId: "i4", dosage: 4.2 }, { ingId: "i1", dosage: 1.8 }, { ingId: "i3", dosage: 0.6 }, { ingId: "i10", dosage: 0.4 }, { ingId: "i7", dosage: 0.3 }],
    notes: "Keep γ-decalactone as the backbone — everything else is there to lift the top and round the edges. Overdosing the ester reads artificial fast.",
  },
  {
    id: "f2", name: "Green Melon Top Note", subtitle: "Sharp, dewy opening for a beverage top note",
    author: "", authorLink: "",
    components: [{ ingId: "i6", dosage: 0.15 }, { ingId: "i9", dosage: 2.0 }, { ingId: "i13", dosage: 0.002 }, { ingId: "i2", dosage: 0.8 }],
    notes: "The methoxypyrazine is active at parts-per-billion — weigh it last and dilute in advance, never dose neat.",
  },
  {
    id: "f3", name: "Toasted Caramel Base", subtitle: "Roasted, sweet base note for bakery and coffee flavors",
    author: "R. Fontaine", authorLink: "https://example.com/rfontaine-formulas",
    components: [{ ingId: "i14", dosage: 0.5 }, { ingId: "i16", dosage: 1.2 }, { ingId: "i19", dosage: 0.3 }, { ingId: "i12", dosage: 0.08 }, { ingId: "i11", dosage: 0.15 }],
    notes: "Furaneol and ethyl maltol compete for the same sweet-caramel space — run a bench trial at half dose of one before adding both at full strength.",
  },
  {
    id: "f4", name: "Dairy Butter Note", subtitle: "Cultured, buttery character for savory and bakery",
    author: "", authorLink: "",
    components: [{ ingId: "i15", dosage: 0.4 }, { ingId: "i4", dosage: 1.0 }, { ingId: "i24", dosage: 0.05 }],
    notes: "Diacetyl fades fast — this note needs re-checking after 48 hours in the finished base.",
  },
];

const STORAGE_KEY_ING = "formulary:ingredients:v1";
const STORAGE_KEY_FORM = "formulary:formulations:v1";

// ---------- UI atoms ----------
function ClassPill({ classId, active, onClick, size = "sm" }) {
  const c = CHEM_CLASSES[classId];
  if (!c) return null;
  const isSmall = size === "sm";
  return (
    <button
      onClick={onClick}
      type="button"
      className={`inline-flex items-center gap-1 rounded border transition-all ${isSmall ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"} font-mono tracking-wide uppercase`}
      style={{ borderColor: c.color, color: active ? "#161310" : c.color, background: active ? c.color : "transparent", cursor: onClick ? "pointer" : "default" }}
    >
      {c.label}
    </button>
  );
}

function NotePill({ note, size = "sm" }) {
  const n = NOTE_LEVELS[note];
  if (!n) return null;
  const isSmall = size === "sm";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full ${isSmall ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"} font-mono uppercase tracking-wide`}
      style={{ background: `${n.color}22`, color: n.color, border: `1px solid ${n.color}55` }}
      title={n.desc}
    >
      {n.label}
    </span>
  );
}

function DescPill({ desc, active, onClick, size = "sm", onRemove }) {
  const color = descColor(desc);
  const isSmall = size === "sm";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border transition-all ${isSmall ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"}`}
      style={{ borderColor: `${color}66`, color: active ? "#161310" : color, background: active ? color : `${color}14` }}
    >
      <button type="button" onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>{desc}</button>
      {onRemove && (
        <button type="button" onClick={onRemove} style={{ color: active ? "#161310" : color }}>
          <X size={10} />
        </button>
      )}
    </span>
  );
}

function SaveIndicator({ status }) {
  if (status === "idle") return null;
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[10px]" style={{ color: status === "error" ? "var(--danger)" : "var(--text-faintest)" }}>
      {status === "saving" && <><Loader2 size={11} className="animate-spin" /> saving…</>}
      {status === "saved" && <><Check size={11} /> saved</>}
      {status === "error" && "save failed"}
    </span>
  );
}

// Downscales an uploaded image to a small square JPEG data URL before it's
// stored — these are just tiny circular icons, and persistent storage has
// tight size limits, so there's no reason to keep a full-resolution photo.
function downscaleImage(file, size = 128) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("Could not decode image"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        // center-crop to a square before scaling down
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Small circular avatar with click-to-upload. Shows a placeholder icon
// until an image is set; once set, shows the image plus a small edit
// affordance on hover/tap.
function ImageAvatar({ image, onChange, size = 40, fallbackIcon }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await downscaleImage(file, 128);
      onChange(dataUrl);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
      title={image ? "Change picture" : "Add a picture"}
      className="relative shrink-0 rounded-full overflow-hidden flex items-center justify-center group"
      style={{ width: size, height: size, background: "var(--bg)", border: "1px solid var(--border)" }}
    >
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      {busy ? (
        <Loader2 size={size * 0.4} className="animate-spin" style={{ color: "var(--text-faint)" }} />
      ) : image ? (
        <img src={image} alt="" className="w-full h-full object-cover" />
      ) : (
        (fallbackIcon || <Camera size={size * 0.42} style={{ color: "var(--text-faint)" }} />)
      )}
      {!busy && (
        <span
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: "rgba(0,0,0,0.45)" }}
        >
          <Camera size={size * 0.38} color="#fff" />
        </span>
      )}
    </button>
  );
}

// A text input that behaves like a single-line field visually but wraps and
// grows vertically as needed, so longer text (e.g. a formulation subtitle)
// is never clipped or forced to scroll horizontally.
function AutoGrowInput({ value, onChange, placeholder, className, style }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={1}
      className={className}
      style={{ resize: "none", overflow: "hidden", ...style }}
    />
  );
}

// ---------- Theme ----------
const THEME_STORAGE_KEY = "formulary:theme:v1";

const THEMES = {
  dark: {
    "--bg": "#161310",
    "--surface": "#1D1913",
    "--surface-alt": "#1A1610",
    "--surface-alt2": "#181410",
    "--surface-sunken": "#0F0D0A",
    "--border": "#332B21",
    "--border-strong": "#3A3226",
    "--border-faint": "#241F17",
    "--border-faint2": "#2B2419",
    "--text": "#EDE4D3",
    "--text-secondary": "#D9CDB8",
    "--text-muted": "#A99B85",
    "--text-faint": "#8A7D68",
    "--text-faintest": "#6B6152",
    "--accent": "#B8834D",
    "--accent-contrast": "#161310",
    "--danger": "#8C3A3A",
    "--danger-bg": "#2A1815",
    "--danger-text": "#D9A0A0",
    "--ethanol": "#4A6B7A",
  },
  light: {
    "--bg": "#F1F8F5",
    "--surface": "#FFFFFF",
    "--surface-alt": "#E6F3EE",
    "--surface-alt2": "#F1F8F5",
    "--surface-sunken": "#FFFFFF",
    "--border": "#CFE8DE",
    "--border-strong": "#BADCCE",
    "--border-faint": "#E1F1EA",
    "--border-faint2": "#D6ECE2",
    "--text": "#173229",
    "--text-secondary": "#25473B",
    "--text-muted": "#3E6357",
    "--text-faint": "#5C8378",
    "--text-faintest": "#6F9389",
    "--accent": "#1C8073",
    "--accent-contrast": "#FFFFFF",
    "--danger": "#A03B3B",
    "--danger-bg": "#F6E4E1",
    "--danger-text": "#8C3A3A",
    "--ethanol": "#2D7A8C",
  },
};

function useTheme() {
  const [theme, setTheme] = useState("light");
  const [themeLoaded, setThemeLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let t = "light";
      try {
        const res = await window.storage.get(THEME_STORAGE_KEY, false);
        if (res?.value === "light" || res?.value === "dark") t = res.value;
      } catch (e) { /* not set yet — default to light */ }
      if (!cancelled) {
        setTheme(t);
        setThemeLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      window.storage.set(THEME_STORAGE_KEY, next, false).catch(() => {});
      return next;
    });
  };

  return { theme, themeLoaded, toggleTheme };
}

// ---------- Main App ----------
export default function FlavorBench() {
  const { theme, themeLoaded, toggleTheme } = useTheme();
  const [ingredients, setIngredients] = useState([]);
  const [formulations, setFormulations] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle");

  const [tab, setTab] = useState("formulations");
  const [view, setView] = useState("grid");
  const [selectedFormId, setSelectedFormId] = useState(null);
  const [selectedIngId, setSelectedIngId] = useState(null);

  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState([]);

  const [query, setQuery] = useState("");
  const [activeClasses, setActiveClasses] = useState([]);
  const [activeDescs, setActiveDescs] = useState([]);
  const [activeNotes, setActiveNotes] = useState([]);

  // Jump to the top of the page whenever the screen changes (grid → detail,
  // detail → ingredient, back to grid, etc.) so opening a recipe or
  // ingredient always starts at the top instead of wherever you scrolled.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [view, selectedFormId, selectedIngId]);

  // ----- Load from persistent storage on mount -----
  useEffect(() => {
    let cancelled = false;
    async function load() {
      let ing = seedIngredients;
      let form = seedFormulations;
      try {
        const ingRes = await window.storage.get(STORAGE_KEY_ING, false);
        if (ingRes?.value) ing = JSON.parse(ingRes.value);
      } catch (e) { /* key not found yet — use seed */ }
      try {
        const formRes = await window.storage.get(STORAGE_KEY_FORM, false);
        if (formRes?.value) form = JSON.parse(formRes.value);
      } catch (e) { /* key not found yet — use seed */ }
      if (!cancelled) {
        // backfill fields for any ingredient/formulation saved before these fields existed
        const normalized = ing.map((i) => ({ altNames: [], avgUsage: "", maxUsage: "", molarMass: "", concentration: 100, image: "", ...i }));
        const normalizedForm = form.map((f) => ({ author: "", authorLink: "", image: "", rating: null, ...f }));
        setIngredients(normalized);
        setFormulations(normalizedForm);
        setLoaded(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // ----- Persist on change (debounced-ish via effect) -----
  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    async function save() {
      setSaveStatus("saving");
      try {
        await window.storage.set(STORAGE_KEY_ING, JSON.stringify(ingredients), false);
        await window.storage.set(STORAGE_KEY_FORM, JSON.stringify(formulations), false);
        if (!cancelled) {
          setSaveStatus("saved");
          setTimeout(() => !cancelled && setSaveStatus("idle"), 1500);
        }
      } catch (e) {
        if (!cancelled) setSaveStatus("error");
      }
    }
    const t = setTimeout(save, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [ingredients, formulations, loaded]);

  const ingMap = useMemo(() => Object.fromEntries(ingredients.map((i) => [i.id, i])), [ingredients]);

  const toggleFrom = (arr, setArr, val) => setArr(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);

  const updateIngredient = (id, patch) => {
    setIngredients((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };
  const deleteIngredient = (id) => {
    setIngredients((prev) => prev.filter((i) => i.id !== id));
    setFormulations((prev) => prev.map((f) => ({ ...f, components: f.components.filter((c) => c.ingId !== id) })));
  };
  const addIngredient = () => {
    const id = `i${Date.now()}`;
    const fresh = { id, name: "New material", altNames: [], cas: "", class: "ester", note: "mid", threshold: "", avgUsage: "", maxUsage: "", molarMass: "", concentration: 100, image: "", descriptors: [] };
    setIngredients((prev) => [fresh, ...prev]);
    return id;
  };

  const updateFormulation = (id, patch) => {
    setFormulations((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const filteredIngredients = useMemo(() => {
    return ingredients.filter((ing) => {
      const q = query.toLowerCase();
      const matchesQuery = !q || ing.name.toLowerCase().includes(q) || (ing.altNames || []).some((n) => n.toLowerCase().includes(q)) || ing.cas.includes(q) || ing.descriptors.some((d) => d.includes(q));
      const matchesClass = activeClasses.length === 0 || activeClasses.includes(ing.class);
      const matchesDesc = activeDescs.every((d) => ing.descriptors.includes(d));
      const matchesNote = activeNotes.length === 0 || activeNotes.includes(ing.note);
      return matchesQuery && matchesClass && matchesDesc && matchesNote;
    });
  }, [ingredients, query, activeClasses, activeDescs, activeNotes]);

  const filteredFormulations = useMemo(() => {
    return formulations.filter((f) => {
      const q = query.toLowerCase();
      const matchesQuery = !q || f.name.toLowerCase().includes(q) || f.subtitle.toLowerCase().includes(q) || f.components.some((c) => {
        const ci = ingMap[c.ingId];
        return ci && (ci.name.toLowerCase().includes(q) || (ci.altNames || []).some((n) => n.toLowerCase().includes(q)));
      });
      const comps = f.components.map((c) => ingMap[c.ingId]).filter(Boolean);
      const matchesClass = activeClasses.length === 0 || comps.some((i) => activeClasses.includes(i.class));
      const matchesDesc = activeDescs.every((d) => comps.some((i) => i.descriptors.includes(d)));
      const matchesNote = activeNotes.length === 0 || comps.some((i) => activeNotes.includes(i.note));
      return matchesQuery && matchesClass && matchesDesc && matchesNote;
    });
  }, [formulations, query, activeClasses, activeDescs, activeNotes, ingMap]);

  const selectedForm = formulations.find((f) => f.id === selectedFormId);
  const selectedIng = ingredients.find((i) => i.id === selectedIngId);

  const clearFilters = () => { setActiveClasses([]); setActiveDescs([]); setActiveNotes([]); };
  const filterCount = activeClasses.length + activeDescs.length + activeNotes.length;

  if (!loaded || !themeLoaded) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center" style={{ ...THEMES.light, background: "var(--bg)", color: "var(--text-faint)" }}>
        <div className="flex items-center gap-2 font-mono text-sm">
          <Loader2 size={16} className="animate-spin" /> loading bench…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full" style={{ ...THEMES[theme], background: "var(--bg)", color: "var(--text)", fontFamily: "'Inter', sans-serif", transition: "background 0.2s ease, color 0.2s ease" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,500&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        .font-display { font-family: 'Fraunces', serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        ::selection { background: var(--accent); color: var(--accent-contrast); }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {view === "grid" && (
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-10">
          <header className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-xs tracking-[0.3em] uppercase" style={{ color: "var(--accent)" }}>flavor & fragrance bench</span>
                <SaveIndicator status={saveStatus} />
              </div>
              <h1 className="font-display text-5xl md:text-6xl font-semibold leading-none">Formulary</h1>
              <p className="mt-3 text-sm md:text-base max-w-md" style={{ color: "var(--text-muted)" }}>
                {ingredients.length} materials in the library · {formulations.length} formulations on the bench. Saved automatically.
              </p>
            </div>
            {tab === "formulations" ? (
              <div className="flex items-center gap-2 self-start md:self-auto">
                <ThemeToggle theme={theme} onToggle={toggleTheme} />
                <button
                  onClick={() => { setCompareMode((v) => !v); setCompareIds([]); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-md font-medium text-sm transition-colors"
                  style={{
                    background: compareMode ? "var(--accent)" : "var(--surface)",
                    color: compareMode ? "var(--accent-contrast)" : "var(--text-muted)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <Columns3 size={16} /> {compareMode ? "Cancel compare" : "Compare"}
                </button>
                <button onClick={() => setView("new")} className="flex items-center gap-2 px-4 py-2.5 rounded-md font-medium text-sm transition-transform hover:-translate-y-0.5" style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}>
                  <Plus size={16} /> New formulation
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 self-start md:self-auto">
                <ThemeToggle theme={theme} onToggle={toggleTheme} />
                <button
                  onClick={() => { const id = addIngredient(); setSelectedIngId(id); setView("ingredientDetail"); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-md font-medium text-sm transition-transform hover:-translate-y-0.5"
                  style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
                >
                  <Plus size={16} /> New material
                </button>
              </div>
            )}
          </header>

          <div className="flex gap-1 mb-6 p-1 rounded-lg w-fit" style={{ background: "var(--surface)" }}>
            <TabButton active={tab === "formulations"} onClick={() => setTab("formulations")} icon={<FlaskConical size={14} />} label="Formulations" />
            <TabButton active={tab === "library"} onClick={() => setTab("library")} icon={<Database size={14} />} label="Ingredient library" />
          </div>

          {tab === "formulations" && (
            <button
              onClick={() => setView("top20")}
              className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide mb-6 -mt-2"
              style={{ color: "var(--text-faint)" }}
            >
              <Trophy size={12} /> View top 20 rated
            </button>
          )}

          <div className="relative mb-4">
            <Search size={16} style={{ color: "var(--text-muted)" }} className="absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === "library" ? "Search by name, CAS, or descriptor…" : "Search formulations or components…"}
              className="w-full pl-11 pr-4 py-3 rounded-lg text-sm outline-none"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
            />
          </div>

          <div className="mb-8 p-4 rounded-lg" style={{ background: "var(--surface-alt)", border: "1px solid var(--border-faint2)" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[10px] tracking-[0.25em] uppercase" style={{ color: "var(--text-faintest)" }}>Filter by attribute</span>
              {filterCount > 0 && (
                <button onClick={clearFilters} className="font-mono text-[10px] uppercase tracking-wide flex items-center gap-1" style={{ color: "var(--accent)" }}>
                  <X size={11} /> clear ({filterCount})
                </button>
              )}
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-[9px] uppercase tracking-wider w-20 shrink-0" style={{ color: "var(--text-faintest)" }}>Class</span>
                {Object.keys(CHEM_CLASSES).map((c) => (
                  <ClassPill key={c} classId={c} active={activeClasses.includes(c)} onClick={() => toggleFrom(activeClasses, setActiveClasses, c)} />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-[9px] uppercase tracking-wider w-20 shrink-0" style={{ color: "var(--text-faintest)" }}>Note</span>
                {Object.keys(NOTE_LEVELS).map((n) => (
                  <button
                    key={n} onClick={() => toggleFrom(activeNotes, setActiveNotes, n)}
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-mono uppercase tracking-wide transition-all"
                    style={{ borderColor: NOTE_LEVELS[n].color, color: activeNotes.includes(n) ? "#161310" : NOTE_LEVELS[n].color, background: activeNotes.includes(n) ? NOTE_LEVELS[n].color : "transparent" }}
                  >
                    {NOTE_LEVELS[n].label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-start gap-1.5">
                <span className="font-mono text-[9px] uppercase tracking-wider w-20 shrink-0 pt-1" style={{ color: "var(--text-faintest)" }}>Descriptor</span>
                <div className="flex flex-wrap gap-1.5 flex-1">
                  {DESCRIPTOR_LIBRARY.map((d) => (
                    <DescPill key={d} desc={d} active={activeDescs.includes(d)} onClick={() => toggleFrom(activeDescs, setActiveDescs, d)} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {tab === "formulations" ? (
            filteredFormulations.length === 0 ? <EmptyState label="No formulations match." /> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredFormulations.map((f) => {
                  const total = flavorTotal(f.components);
                  const eth = ethanolPct(f.components);
                  const comps = f.components.map((c) => ingMap[c.ingId]).filter(Boolean);
                  const classesInvolved = [...new Set(comps.map((c) => c.class))];
                  const isSelected = compareIds.includes(f.id);
                  return (
                    <button
                      key={f.id}
                      onClick={() => {
                        if (compareMode) {
                          setCompareIds((prev) => (prev.includes(f.id) ? prev.filter((id) => id !== f.id) : [...prev, f.id]));
                        } else {
                          setSelectedFormId(f.id);
                          setView("detail");
                        }
                      }}
                      className="text-left p-5 rounded-lg transition-all hover:-translate-y-1 relative"
                      style={{
                        background: "var(--surface)",
                        border: isSelected ? "2px solid var(--accent)" : "1px solid var(--border)",
                      }}
                    >
                      {compareMode && (
                        <div
                          className="absolute top-3 right-3 rounded-full flex items-center justify-center"
                          style={{
                            width: 22, height: 22,
                            background: isSelected ? "var(--accent)" : "var(--bg)",
                            border: `1px solid ${isSelected ? "var(--accent)" : "var(--border-strong)"}`,
                          }}
                        >
                          {isSelected && <Check size={13} color="var(--accent-contrast)" />}
                        </div>
                      )}
                      <div className="flex items-start justify-between mb-3">
                        <ImageAvatar
                          image={f.image}
                          onChange={(dataUrl) => updateFormulation(f.id, { image: dataUrl })}
                          size={34}
                          fallbackIcon={<FlaskConical size={16} style={{ color: "var(--accent)" }} />}
                        />
                        {!compareMode && (
                          <span className="font-mono text-[10px] text-right" style={{ color: "var(--text-faintest)" }}>{total.toFixed(2)} g flavor<br/>{eth.toFixed(2)} g ethanol</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="font-display text-xl font-semibold">{f.name}</h3>
                        {f.rating != null && (
                          <span className="flex items-center gap-1 font-mono text-xs shrink-0" style={{ color: "var(--accent)" }}>
                            <Star size={12} fill="var(--accent)" /> {f.rating.toFixed(1)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>{f.subtitle}</p>
                      <div className="flex flex-wrap gap-1 mb-2">{classesInvolved.slice(0, 4).map((c) => <ClassPill key={c} classId={c} />)}</div>
                      <div className="font-mono text-[10px] flex items-center justify-between gap-2" style={{ color: "var(--text-faintest)" }}>
                        <span>{f.components.length} components</span>
                        {f.author && <span className="flex items-center gap-1 truncate"><User size={10} /> {f.author}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )
          ) : (
            filteredIngredients.length === 0 ? <EmptyState label="No ingredients match." /> : (
              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider" style={{ background: "var(--surface)", color: "var(--text-faintest)" }}>
                  <span>Material</span><span>Class</span><span>Note</span>
                </div>
                {filteredIngredients.map((ing, idx) => (
                  <button key={ing.id} onClick={() => { setSelectedIngId(ing.id); setView("ingredientDetail"); }} className="w-full text-left px-4 py-3 transition-colors" style={{ background: idx % 2 === 0 ? "var(--bg)" : "var(--surface-alt2)", borderTop: "1px solid var(--border-faint)" }}>
                    <div className="grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center">
                      <ImageAvatar
                        image={ing.image}
                        onChange={(dataUrl) => updateIngredient(ing.id, { image: dataUrl })}
                        size={34}
                        fallbackIcon={<Beaker size={15} style={{ color: "var(--text-faint)" }} />}
                      />
                      <div>
                        <div className="text-sm" style={{ color: "var(--text)" }}>{ing.name}</div>
                        {ing.altNames && ing.altNames.length > 0 && (
                          <div className="text-[11px] italic truncate" style={{ color: "var(--text-faint)" }}>
                            aka {ing.altNames.join(", ")}
                          </div>
                        )}
                        <div className="font-mono text-[10px]" style={{ color: "var(--text-faintest)" }}>
                          {ing.cas ? `CAS ${ing.cas}` : "no CAS set"}
                          {ing.molarMass !== "" && ing.molarMass != null && ` · ${ing.molarMass} g/mol`}
                          {(ing.concentration ?? 100) < 100 && ` · ${ing.concentration}% conc.`}
                        </div>
                      </div>
                      <ClassPill classId={ing.class} />
                      <NotePill note={ing.note} />
                    </div>
                    {ing.descriptors.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {ing.descriptors.map((d) => <DescPill key={d} desc={d} />)}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )
          )}

          {compareMode && (
            <div
              className="fixed bottom-0 left-0 right-0 flex items-center justify-center px-4 py-4 z-20"
              style={{ background: "linear-gradient(to top, var(--bg) 60%, transparent)" }}
            >
              <div
                className="flex items-center gap-4 px-5 py-3 rounded-full shadow-lg"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                  {compareIds.length === 0 ? "Select formulations to compare" : `${compareIds.length} selected`}
                </span>
                <button
                  disabled={compareIds.length < 2}
                  onClick={() => setView("compare")}
                  className="flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm"
                  style={{
                    background: compareIds.length >= 2 ? "var(--accent)" : "var(--border)",
                    color: compareIds.length >= 2 ? "var(--accent-contrast)" : "var(--text-faintest)",
                    cursor: compareIds.length >= 2 ? "pointer" : "not-allowed",
                  }}
                >
                  <Columns3 size={15} /> Compare
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {view === "detail" && selectedForm && (
        <FormulationDetail
          formulation={selectedForm}
          ingredients={ingredients}
          ingMap={ingMap}
          onBack={() => setView("grid")}
          onDelete={() => { setFormulations((prev) => prev.filter((f) => f.id !== selectedForm.id)); setView("grid"); }}
          onOpenIngredient={(id) => { setSelectedIngId(id); setView("ingredientDetail"); }}
          onUpdate={(patch) => updateFormulation(selectedForm.id, patch)}
        />
      )}

      {view === "ingredientDetail" && selectedIng && (
        <IngredientDetail
          ingredient={selectedIng}
          usedIn={formulations.filter((f) => f.components.some((c) => c.ingId === selectedIng.id))}
          onBack={() => setView("grid")}
          onOpenFormulation={(id) => { setSelectedFormId(id); setView("detail"); }}
          onUpdate={(patch) => updateIngredient(selectedIng.id, patch)}
          onDelete={() => { deleteIngredient(selectedIng.id); setView("grid"); }}
        />
      )}

      {view === "new" && (
        <NewFormulationForm
          ingredients={ingredients}
          onCancel={() => setView("grid")}
          onSave={(form) => { setFormulations((prev) => [{ ...form, id: `f${Date.now()}` }, ...prev]); setView("grid"); }}
        />
      )}

      {view === "compare" && (
        <CompareView
          formulations={formulations.filter((f) => compareIds.includes(f.id))}
          ingMap={ingMap}
          onBack={() => { setView("grid"); }}
          onOpenFormulation={(id) => { setSelectedFormId(id); setCompareMode(false); setCompareIds([]); setView("detail"); }}
        />
      )}

      {view === "top20" && (
        <Top20View
          formulations={formulations}
          onBack={() => setView("grid")}
          onOpenFormulation={(id) => { setSelectedFormId(id); setView("detail"); }}
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors" style={{ background: active ? "var(--border)" : "transparent", color: active ? "var(--text)" : "var(--text-faint)" }}>
      {icon} {label}
    </button>
  );
}

function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === "dark";
  return (
    <button
      onClick={onToggle}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex items-center justify-center rounded-md transition-colors"
      style={{ width: 40, height: 40, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

function EmptyState({ label }) {
  return (
    <div className="text-center py-20" style={{ color: "var(--text-faintest)" }}>
      <Beaker size={28} className="mx-auto mb-3" />
      <p className="font-display text-lg">{label}</p>
      <p className="text-sm mt-1">Try clearing a filter.</p>
    </div>
  );
}

// ---------- Editable field primitives ----------
function EditableText({ value, onChange, placeholder, mono, className, big }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
      style={{
        background: "transparent",
        border: "none",
        borderBottom: "1px dashed var(--border-strong)",
        color: "var(--text)",
        outline: "none",
        padding: "2px 0",
        fontFamily: mono ? "'JetBrains Mono', monospace" : "inherit",
        fontSize: big ? "inherit" : 14,
        width: "100%",
      }}
    />
  );
}

function LabeledEditable({ label, children }) {
  return (
    <div className="p-3 rounded-md" style={{ background: "var(--bg)" }}>
      <div className="font-mono text-[9px] uppercase tracking-wider mb-1.5" style={{ color: "var(--text-faintest)" }}>{label}</div>
      {children}
    </div>
  );
}

// ---------- Ingredient detail (fully editable) ----------
function IngredientDetail({ ingredient, usedIn, onBack, onOpenFormulation, onUpdate, onDelete }) {
  const [copied, setCopied] = useState(false);
  const [descInput, setDescInput] = useState("");
  const [altInput, setAltInput] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const addDescriptor = (d) => {
    const clean = d.trim().toLowerCase();
    if (!clean || ingredient.descriptors.includes(clean)) return;
    onUpdate({ descriptors: [...ingredient.descriptors, clean] });
    setDescInput("");
  };
  const removeDescriptor = (d) => onUpdate({ descriptors: ingredient.descriptors.filter((x) => x !== d) });

  const altNames = ingredient.altNames || [];
  const addAltName = (n) => {
    const clean = n.trim();
    if (!clean || altNames.some((x) => x.toLowerCase() === clean.toLowerCase())) return;
    onUpdate({ altNames: [...altNames, clean] });
    setAltInput("");
  };
  const removeAltName = (n) => onUpdate({ altNames: altNames.filter((x) => x !== n) });

  return (
    <div className="max-w-2xl mx-auto px-5 md:px-8 py-10">
      <button onClick={onBack} className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide mb-8" style={{ color: "var(--accent)" }}>
        <ChevronLeft size={14} /> back
      </button>

      <div className="rounded-xl p-6 md:p-10" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Pencil size={13} style={{ color: "var(--text-faintest)" }} />
              <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: "var(--text-faintest)" }}>editable</span>
            </div>
            <input
              value={ingredient.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="font-display text-3xl md:text-4xl font-semibold bg-transparent outline-none w-full"
              style={{ color: "var(--text)", border: "none", borderBottom: "1px dashed var(--border-strong)" }}
            />
            <div className="flex items-center gap-2 mt-3">
              <span className="font-mono text-xs" style={{ color: "var(--text-faintest)" }}>CAS</span>
              <input
                value={ingredient.cas}
                onChange={(e) => onUpdate({ cas: e.target.value })}
                placeholder="000-00-0"
                className="font-mono text-xs bg-transparent outline-none"
                style={{ color: "var(--text)", border: "none", borderBottom: "1px dashed var(--border-strong)", width: 120 }}
              />
              {ingredient.cas && (
                <button onClick={() => { navigator.clipboard?.writeText(ingredient.cas); setCopied(true); setTimeout(() => setCopied(false), 1200); }} style={{ color: "var(--text-faintest)" }}>
                  <Copy size={11} />
                </button>
              )}
              {copied && <span className="font-mono text-[10px]" style={{ color: "var(--accent)" }}>copied</span>}
            </div>
          </div>
          <ImageAvatar
            image={ingredient.image}
            onChange={(dataUrl) => onUpdate({ image: dataUrl })}
            size={48}
            fallbackIcon={<Beaker size={22} style={{ color: "var(--accent)" }} />}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <LabeledEditable label="Chemical class">
            <select
              value={ingredient.class}
              onChange={(e) => onUpdate({ class: e.target.value })}
              className="w-full text-sm bg-transparent outline-none"
              style={{ color: "var(--text)", border: "none" }}
            >
              {Object.entries(CHEM_CLASSES).map(([key, c]) => (
                <option key={key} value={key} style={{ background: "var(--surface)" }}>{c.label}</option>
              ))}
            </select>
          </LabeledEditable>
          <LabeledEditable label="Volatility / note">
            <select
              value={ingredient.note}
              onChange={(e) => onUpdate({ note: e.target.value })}
              className="w-full text-sm bg-transparent outline-none"
              style={{ color: "var(--text)", border: "none" }}
            >
              {Object.entries(NOTE_LEVELS).map(([key, n]) => (
                <option key={key} value={key} style={{ background: "var(--surface)" }}>{n.label} — {n.desc}</option>
              ))}
            </select>
          </LabeledEditable>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <LabeledEditable label="Odor threshold">
            <EditableText value={ingredient.threshold} onChange={(v) => onUpdate({ threshold: v })} placeholder="e.g. 0.002 ppm" mono />
          </LabeledEditable>
          <LabeledEditable label="Avg usage in beverages">
            <EditableText value={ingredient.avgUsage || ""} onChange={(v) => onUpdate({ avgUsage: v })} placeholder="e.g. 5 ppm" mono />
          </LabeledEditable>
          <LabeledEditable label="Max usage in beverages">
            <EditableText value={ingredient.maxUsage || ""} onChange={(v) => onUpdate({ maxUsage: v })} placeholder="e.g. 20 ppm" mono />
          </LabeledEditable>
          <LabeledEditable label="Molar mass (g/mol)">
            <input
              value={ingredient.molarMass ?? ""}
              onChange={(e) => onUpdate({ molarMass: e.target.value === "" ? "" : parseFloat(e.target.value) || e.target.value })}
              placeholder="e.g. 116.16"
              type="number"
              step="0.01"
              className="w-full text-sm bg-transparent outline-none"
              style={{
                background: "transparent",
                border: "none",
                borderBottom: "1px dashed var(--border-strong)",
                color: "var(--text)",
                outline: "none",
                padding: "2px 0",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            />
          </LabeledEditable>
          <LabeledEditable label="Concentration">
            <div className="flex items-baseline gap-1">
              <input
                value={ingredient.concentration ?? 100}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") { onUpdate({ concentration: "" }); return; }
                  const n = parseFloat(v);
                  if (isNaN(n)) return;
                  onUpdate({ concentration: Math.min(100, Math.max(1, n)) });
                }}
                placeholder="100"
                type="number"
                min="1"
                max="100"
                step="0.1"
                className="w-full text-sm bg-transparent outline-none"
                style={{
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px dashed var(--border-strong)",
                  color: "var(--text)",
                  outline: "none",
                  padding: "2px 0",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              />
              <span className="font-mono text-sm" style={{ color: "var(--text-faint)" }}>%</span>
            </div>
          </LabeledEditable>
        </div>
        <p className="text-[11px] -mt-2" style={{ color: "var(--text-faintest)" }}>
          Concentration is the proportion of active material in this ingredient as supplied (100% = neat/pure). If diluted, formulation totals still count the full weighed-in amount, but flavor/PPM calculations use the active portion only.
        </p>

        <div className="mt-6">
          <h2 className="font-mono text-[11px] tracking-[0.25em] uppercase mb-3" style={{ color: "var(--accent)" }}>Also known as</h2>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {altNames.length === 0 && <span className="text-xs" style={{ color: "var(--text-faintest)" }}>No alternative names yet — add synonyms below.</span>}
            {altNames.map((n) => (
              <span key={n} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs italic" style={{ borderColor: "var(--border-strong)", color: "var(--text-secondary)", background: "var(--bg)" }}>
                {n}
                <button type="button" onClick={() => removeAltName(n)} style={{ color: "var(--text-faintest)" }}><X size={10} /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={altInput}
              onChange={(e) => setAltInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addAltName(altInput); }}
              placeholder="e.g. Gamma-decalactone, Peach Aldehyde C-14…"
              className="flex-1 px-3 py-2 rounded text-sm outline-none"
              style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
            />
            <button onClick={() => addAltName(altInput)} className="px-3 py-2 rounded text-sm font-mono" style={{ background: "var(--border)", color: "var(--text)" }}>
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="mt-6">
          <h2 className="font-mono text-[11px] tracking-[0.25em] uppercase mb-3" style={{ color: "var(--accent)" }}>Taste / odor profile</h2>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {ingredient.descriptors.map((d) => (
              <DescPill key={d} desc={d} size="md" onRemove={() => removeDescriptor(d)} />
            ))}
            {ingredient.descriptors.length === 0 && <span className="text-xs" style={{ color: "var(--text-faintest)" }}>No descriptors yet — add some below.</span>}
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {DESCRIPTOR_LIBRARY.filter((d) => !ingredient.descriptors.includes(d)).map((d) => (
              <DescPill key={d} desc={d} onClick={() => addDescriptor(d)} />
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={descInput}
              onChange={(e) => setDescInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addDescriptor(descInput); }}
              placeholder="Add a custom descriptor…"
              className="flex-1 px-3 py-2 rounded text-sm outline-none"
              style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
            />
            <button onClick={() => addDescriptor(descInput)} className="px-3 py-2 rounded text-sm font-mono" style={{ background: "var(--border)", color: "var(--text)" }}>
              <Plus size={14} />
            </button>
          </div>
        </div>

        {usedIn.length > 0 && (
          <div className="mt-8">
            <h2 className="font-mono text-[11px] tracking-[0.25em] uppercase mb-3" style={{ color: "var(--accent)" }}>Used in</h2>
            <div className="space-y-2">
              {usedIn.map((f) => (
                <button key={f.id} onClick={() => onOpenFormulation(f.id)} className="w-full text-left p-3 rounded-md flex items-center justify-between" style={{ background: "var(--bg)" }}>
                  <span className="text-sm" style={{ color: "var(--text)" }}>{f.name}</span>
                  <span className="font-mono text-[10px]" style={{ color: "var(--text-faintest)" }}>{f.components.find((c) => c.ingId === ingredient.id)?.dosage} g</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide" style={{ color: "var(--danger)" }}>
              <Trash2 size={13} /> remove material
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>Remove from library and all formulations?</span>
              <button onClick={onDelete} className="font-mono text-xs uppercase tracking-wide px-3 py-1.5 rounded" style={{ background: "var(--danger)", color: "var(--text)" }}>Confirm</button>
              <button onClick={() => setConfirmDelete(false)} className="font-mono text-xs uppercase tracking-wide" style={{ color: "var(--text-faintest)" }}>Cancel</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Formulation detail ----------
function FormulationDetail({ formulation, ingredients, ingMap, onBack, onDelete, onOpenIngredient, onUpdate }) {
  const total = flavorTotal(formulation.components); // raw weighed-in mass, for batch/ethanol balance
  const effectiveTotal = effectiveFlavorTotal(formulation.components, ingMap); // active flavor content, for PPM/content calcs
  const eth = ethanolPct(formulation.components);
  const overLimit = total > 100;
  const sorted = [...formulation.components]
    .map((c, i) => ({ ...c, _origIndex: i }))
    .sort((a, b) => b.dosage - a.dosage);
  const author = formulation.author || "";
  const authorLink = formulation.authorLink || "";

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [sampleMg, setSampleMg] = useState(1);
  const sampleMgValid = typeof sampleMg === "number" && !isNaN(sampleMg) && sampleMg >= 0;
  const sampleFactor = sampleMgValid ? sampleMg / 100 : 0; // dosage is g per 100g batch

  const [sample01kgG, setSample01kgG] = useState(1);
  const sample01kgValid = typeof sample01kgG === "number" && !isNaN(sample01kgG) && sample01kgG >= 0;
  const sample01kgFactor = sample01kgValid ? sample01kgG / 100 : 0;

  const [sample1kgG, setSample1kgG] = useState(1);
  const sample1kgValid = typeof sample1kgG === "number" && !isNaN(sample1kgG) && sample1kgG >= 0;
  const sample1kgFactor = sample1kgValid ? sample1kgG / 100 : 0;

  const existingIds = new Set(formulation.components.map((c) => c.ingId));
  const pickerResults = ingredients.filter(
    (i) => i.name.toLowerCase().includes(pickerQuery.toLowerCase()) && !existingIds.has(i.id)
  );

  const updateDosage = (origIndex, value) => {
    const next = formulation.components.map((c, i) => (i === origIndex ? { ...c, dosage: value } : c));
    onUpdate({ components: next });
  };
  const removeComponent = (origIndex) => {
    onUpdate({ components: formulation.components.filter((_, i) => i !== origIndex) });
  };
  const addComponent = (ingId) => {
    onUpdate({ components: [...formulation.components, { ingId, dosage: 0 }] });
    setPickerOpen(false);
    setPickerQuery("");
  };

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-10">
      <button onClick={onBack} className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide mb-8" style={{ color: "var(--accent)" }}>
        <ChevronLeft size={14} /> back to bench
      </button>

      <div className="rounded-xl p-6 md:p-10 relative" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ backgroundImage: "repeating-linear-gradient(90deg, var(--accent) 0 8px, transparent 8px 16px)" }} />
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <div className="font-mono text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: overLimit ? "var(--danger)" : "var(--text-faintest)" }}>
              {formulation.components.length} components · {total.toFixed(2)} g flavor · {eth.toFixed(2)} g ethanol · 100 g total
            </div>
            <AutoGrowInput
              value={formulation.name}
              onChange={(v) => onUpdate({ name: v })}
              placeholder="Formulation name"
              className="font-display text-4xl md:text-5xl font-semibold bg-transparent outline-none w-full block"
              style={{ color: "var(--text)", border: "none", borderBottom: "1px dashed var(--border-strong)", lineHeight: 1.15 }}
            />
            <AutoGrowInput
              value={formulation.subtitle}
              onChange={(v) => onUpdate({ subtitle: v })}
              placeholder="Short description"
              className="mt-2 text-sm md:text-base bg-transparent outline-none w-full block"
              style={{ color: "var(--text-muted)", border: "none", borderBottom: "1px dashed var(--border-strong)", padding: "2px 0", fontFamily: "inherit", lineHeight: 1.5 }}
            />
          </div>
          <ImageAvatar
            image={formulation.image}
            onChange={(dataUrl) => onUpdate({ image: dataUrl })}
            size={48}
            fallbackIcon={<FlaskConical size={22} style={{ color: "var(--accent)" }} />}
          />
        </div>

        <div className="mt-5 p-3 rounded-md grid sm:grid-cols-3 gap-3" style={{ background: "var(--bg)", border: "1px dashed var(--border)" }}>
          <div>
            <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider mb-1.5" style={{ color: "var(--text-faintest)" }}>
              <User size={11} /> Formulated by
            </div>
            <input
              value={author}
              onChange={(e) => onUpdate({ author: e.target.value })}
              placeholder="Add a name…"
              className="w-full text-sm bg-transparent outline-none"
              style={{ color: "var(--text)", border: "none", borderBottom: "1px dashed var(--border-strong)", padding: "2px 0" }}
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider mb-1.5" style={{ color: "var(--text-faintest)" }}>
              <LinkIcon size={11} /> Source link
            </div>
            <input
              value={authorLink}
              onChange={(e) => onUpdate({ authorLink: e.target.value })}
              placeholder="https://…"
              className="w-full text-sm bg-transparent outline-none font-mono"
              style={{ color: authorLink ? "var(--accent)" : "var(--text)", border: "none", borderBottom: "1px dashed var(--border-strong)", padding: "2px 0" }}
            />
            {authorLink && (
              <a href={authorLink} target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono mt-1 inline-block" style={{ color: "var(--text-faintest)" }}>
                open link ↗
              </a>
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider mb-1.5" style={{ color: "var(--text-faintest)" }}>
              <Star size={11} /> Rating
            </div>
            <div className="flex items-baseline gap-1">
              <input
                value={formulation.rating ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") { onUpdate({ rating: null }); return; }
                  const n = parseFloat(v);
                  if (isNaN(n)) return;
                  onUpdate({ rating: Math.min(10, Math.max(0.1, Math.round(n * 10) / 10)) });
                }}
                placeholder="—"
                type="number"
                min="0.1"
                max="10"
                step="0.1"
                className="text-sm bg-transparent outline-none"
                style={{ color: "var(--text)", border: "none", borderBottom: "1px dashed var(--border-strong)", padding: "2px 0", width: 56 }}
              />
              <span className="font-mono text-xs" style={{ color: "var(--text-faintest)" }}>/ 10.0</span>
            </div>
          </div>
        </div>

        {overLimit && (
          <div className="mt-4 p-3 rounded-md text-sm flex gap-2" style={{ background: "var(--danger-bg)", color: "var(--danger-text)", border: "1px solid var(--danger)55" }}>
            <AlertTriangle size={16} className="shrink-0 mt-0.5" style={{ color: "var(--danger)" }} />
            Flavor components total {total.toFixed(2)} g, over 100 g. Reduce dosage so ethanol can fill the remainder.
          </div>
        )}

        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-mono text-[11px] tracking-[0.25em] uppercase" style={{ color: "var(--accent)" }}>Formula</h2>
            <span className="font-mono text-[10px] flex items-center gap-1" style={{ color: "var(--text-faintest)" }}><ArrowUpDown size={11} /> sorted by dosage</span>
          </div>
          <div className="space-y-0">
            {sorted.map((c) => {
              const ing = ingMap[c.ingId];
              if (!ing) return null;
              const pct = c.dosage;
              return (
                <div key={c._origIndex} className="w-full text-left py-3 flex flex-col gap-1.5" style={{ borderBottom: "1px dashed var(--border)" }}>
                  <div className="flex items-baseline justify-between gap-3">
                    <button onClick={() => onOpenIngredient(ing.id)} className="text-left" style={{ color: "var(--text)" }}>
                      {ing.name}
                      {ing.altNames && ing.altNames.length > 0 && (
                        <span className="text-xs italic ml-2" style={{ color: "var(--text-faint)" }}>aka {ing.altNames.join(", ")}</span>
                      )}
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        value={c.dosage}
                        onChange={(e) => updateDosage(c._origIndex, parseFloat(e.target.value) || 0)}
                        type="number"
                        step="0.01"
                        className="font-mono text-sm text-right bg-transparent outline-none"
                        style={{ color: "var(--accent)", border: "none", borderBottom: "1px dashed var(--border-strong)", width: 60 }}
                      />
                      <span className="font-mono text-sm" style={{ color: "var(--accent)" }}>g</span>
                      <button onClick={() => removeComponent(c._origIndex)} style={{ color: "var(--danger)" }}>
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="font-mono text-[10px] flex flex-wrap gap-x-3" style={{ color: "var(--text-faintest)" }}>
                    <span>threshold: {ing.threshold ? ing.threshold : "not set"}</span>
                    <span>avg use: {ing.avgUsage ? ing.avgUsage : "not set"}</span>
                    <span>max use: {ing.maxUsage ? ing.maxUsage : "not set"}</span>
                    <span>M: {ing.molarMass !== "" && ing.molarMass != null ? `${ing.molarMass} g/mol` : "not set"}</span>
                    <span style={{ color: (ing.concentration ?? 100) < 100 ? "var(--accent)" : "var(--text-faintest)" }}>
                      conc: {ing.concentration ?? 100}%{(ing.concentration ?? 100) < 100 ? ` → ${effectiveDosage(c.dosage, ing).toFixed(4)} g active` : ""}
                    </span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--bg)" }}>
                    <div className="h-full" style={{ width: `${Math.min(pct, 100)}%`, background: CHEM_CLASSES[ing.class]?.color || "var(--accent)" }} />
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <ClassPill classId={ing.class} />
                    <NotePill note={ing.note} />
                    {ing.descriptors.slice(0, 4).map((d) => <DescPill key={d} desc={d} />)}
                  </div>
                </div>
              );
            })}
            {/* Ethanol remainder row */}
            <div className="w-full text-left py-3 flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-2" style={{ color: "var(--text)" }}>
                  {ETHANOL.name}
                  <span className="font-mono text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: "var(--border)", color: "var(--text-faint)" }}>remainder</span>
                </span>
                <span className="font-mono text-sm shrink-0" style={{ color: "var(--accent)" }}>{eth.toFixed(2)} g</span>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--bg)" }}>
                <div className="h-full" style={{ width: `${eth}%`, background: "var(--ethanol)" }} />
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                <ClassPill classId="alcohol" />
                <span className="text-[10px] font-mono" style={{ color: "var(--text-faintest)" }}>fills to 100 g automatically</span>
              </div>
            </div>
          </div>

          {/* Add component */}
          <div className="mt-4 relative">
            {!pickerOpen ? (
              <button
                onClick={() => setPickerOpen(true)}
                className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide"
                style={{ color: "var(--accent)" }}
              >
                <Plus size={14} /> add ingredient
              </button>
            ) : (
              <div className="rounded-md overflow-hidden" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2 px-2">
                  <Search size={14} style={{ color: "var(--text-faintest)" }} />
                  <input
                    autoFocus
                    value={pickerQuery}
                    onChange={(e) => setPickerQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Escape") { setPickerOpen(false); setPickerQuery(""); } }}
                    placeholder="Search materials…"
                    className="flex-1 py-2 text-sm outline-none bg-transparent"
                    style={{ color: "var(--text)" }}
                  />
                  <button onClick={() => { setPickerOpen(false); setPickerQuery(""); }} style={{ color: "var(--text-faintest)" }}>
                    <X size={14} />
                  </button>
                </div>
                <div className="max-h-56 overflow-y-auto" style={{ borderTop: "1px solid var(--border)" }}>
                  {pickerResults.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => addComponent(opt.id)}
                      className="w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-white/5"
                      style={{ color: "var(--text)" }}
                    >
                      <span>{opt.name}</span>
                      <ClassPill classId={opt.class} />
                    </button>
                  ))}
                  {pickerResults.length === 0 && (
                    <div className="px-3 py-2 text-sm" style={{ color: "var(--text-faintest)" }}>
                      {existingIds.size === ingredients.length ? "Every material is already in this formulation." : "No materials match."}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 10 g alternative — same proportions, scaled down by 10 */}
        <div className="mt-8 pt-6" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-mono text-[11px] tracking-[0.25em] uppercase" style={{ color: "var(--accent)" }}>10 g alternative</h2>
            <span className="font-mono text-[10px]" style={{ color: "var(--text-faintest)" }}>{(total / 10).toFixed(3)} g flavor · {(eth / 10).toFixed(3)} g ethanol</span>
          </div>
          <p className="text-[11px] mb-3" style={{ color: "var(--text-faintest)" }}>
            Same formulation, same proportions, scaled to a 10 g batch — each amount below is the 100 g dosage divided by 10.
          </p>

          <div className="space-y-0">
            {sorted.map((c) => {
              const ing = ingMap[c.ingId];
              if (!ing) return null;
              const scaledMg = c.dosage / 10;
              return (
                <div key={c._origIndex} className="py-2 flex items-baseline justify-between gap-3" style={{ borderBottom: "1px dashed var(--border-faint)" }}>
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{ing.name}</span>
                  <span className="font-mono text-sm shrink-0" style={{ color: "var(--accent)" }}>{scaledMg.toFixed(3)} g</span>
                </div>
              );
            })}
            <div className="py-2 flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                {ETHANOL.name}
                <span className="font-mono text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: "var(--border)", color: "var(--text-faint)" }}>remainder</span>
              </span>
              <span className="font-mono text-sm shrink-0" style={{ color: "var(--accent)" }}>{(eth / 10).toFixed(3)} g</span>
            </div>
          </div>
        </div>

        {/* PPM summary */}
        <div className="mt-8 pt-6" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-mono text-[11px] tracking-[0.25em] uppercase" style={{ color: "var(--accent)" }}>PPM basis (per 100 g batch)</h2>
          </div>
          <p className="text-[11px] -mt-2 mb-3" style={{ color: "var(--text-faintest)" }}>
            Reflects active content: any ingredient below 100% concentration contributes only its active portion here, even though its full weighed-in mass counts toward the 100 g batch above.
          </p>

          <div className="flex items-baseline justify-between py-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <span className="text-sm" style={{ color: "var(--text)" }}>ppm flavor <span className="text-xs" style={{ color: "var(--text-faintest)" }}>(total)</span></span>
            <span className="font-mono text-sm" style={{ color: "var(--accent)" }}>{toPpm(effectiveTotal).toLocaleString(undefined, { maximumFractionDigits: 0 })} ppm</span>
          </div>

          <div className="space-y-0 mt-1">
            {sorted.map((c) => {
              const ing = ingMap[c.ingId];
              if (!ing) return null;
              return (
                <div key={c._origIndex} className="flex items-baseline justify-between py-2" style={{ borderBottom: "1px dashed var(--border-faint)" }}>
                  <span className="text-sm flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                    {ing.name}
                    <span className="font-mono text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: "var(--border)", color: "var(--text-faint)" }}>ppm flavor component</span>
                  </span>
                  <span className="font-mono text-sm shrink-0" style={{ color: "var(--accent)" }}>{toPpm(effectiveDosage(c.dosage, ing)).toLocaleString(undefined, { maximumFractionDigits: 0 })} ppm</span>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] mt-3" style={{ color: "var(--text-faintest)" }}>
            Computed on the 100 g formulation basis: 1 mg per 100 g = 10,000 ppm.
          </p>

          {/* Editable sample: g content in an arbitrary amount of solution, defaulting to 1 g */}
          <div className="mt-6 pt-5" style={{ borderTop: "1px dashed var(--border)" }}>
            <div className="flex items-baseline gap-2 flex-wrap mb-1">
              <h3 className="font-mono text-[11px] tracking-[0.25em] uppercase" style={{ color: "var(--text-faint)" }}>
                Example — if
              </h3>
              <input
                type="number"
                min="0"
                step="any"
                value={sampleMg}
                onChange={(e) => {
                  const v = e.target.value;
                  setSampleMg(v === "" ? "" : parseFloat(v));
                }}
                className="font-mono text-sm text-right bg-transparent outline-none"
                style={{ color: "var(--accent)", border: "none", borderBottom: "1px dashed var(--border-strong)", width: 70, padding: "0 2px" }}
              />
              <h3 className="font-mono text-[11px] tracking-[0.25em] uppercase" style={{ color: "var(--text-faint)" }}>
                g of solution is taken
              </h3>
            </div>
            <p className="text-[11px] mb-3" style={{ color: "var(--text-faintest)" }}>
              {sampleMgValid
                ? `${sampleMg} g is ${(sampleMg / 100).toLocaleString(undefined, { maximumFractionDigits: 5 })}× the 100 g batch, so each amount below is the dosage × (${sampleMg} ÷ 100).`
                : "Enter a non-negative amount of solution above."}
            </p>

            <div className="flex items-baseline justify-between py-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <span className="text-sm" style={{ color: "var(--text)" }}>flavor <span className="text-xs" style={{ color: "var(--text-faintest)" }}>(total, in {sampleMgValid ? sampleMg : "—"} g)</span></span>
              <span className="font-mono text-sm" style={{ color: "var(--accent)" }}>{(effectiveTotal * sampleFactor).toLocaleString(undefined, { maximumFractionDigits: 5 })} g</span>
            </div>

            <div className="space-y-0 mt-1">
              {sorted.map((c) => {
                const ing = ingMap[c.ingId];
                if (!ing) return null;
                return (
                  <div key={c._origIndex} className="flex items-baseline justify-between py-2" style={{ borderBottom: "1px dashed var(--border-faint)" }}>
                    <span className="text-sm flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                      {ing.name}
                      <span className="font-mono text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: "var(--border)", color: "var(--text-faint)" }}>flavor component, in {sampleMgValid ? sampleMg : "—"} g</span>
                    </span>
                    <span className="font-mono text-sm shrink-0" style={{ color: "var(--accent)" }}>{(effectiveDosage(c.dosage, ing) * sampleFactor).toLocaleString(undefined, { maximumFractionDigits: 5 })} g</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Beverage dilution example: an independently editable gram amount is diluted into
              0.1 L (~100 g) of finished beverage. g-of-ingredient-in-sample = dosage/100 * sample01kgG,
              so its ppm in the finished beverage = (dosage/100 * sample01kgG / 100) * 1,000,000 = dosage * sample01kgFactor * 10,000. */}
          <div className="mt-6 pt-5" style={{ borderTop: "1px dashed var(--border)" }}>
            <div className="flex items-baseline gap-2 flex-wrap mb-1">
              <h3 className="font-mono text-[11px] tracking-[0.25em] uppercase" style={{ color: "var(--text-faint)" }}>
                Example — if
              </h3>
              <input
                type="number"
                min="0"
                step="any"
                value={sample01kgG}
                onChange={(e) => {
                  const v = e.target.value;
                  setSample01kgG(v === "" ? "" : parseFloat(v));
                }}
                className="font-mono text-sm text-right bg-transparent outline-none"
                style={{ color: "var(--accent)", border: "none", borderBottom: "1px dashed var(--border-strong)", width: 70, padding: "0 2px" }}
              />
              <h3 className="font-mono text-[11px] tracking-[0.25em] uppercase" style={{ color: "var(--text-faint)" }}>
                g solution is diluted in 0.1 L of beverage
              </h3>
            </div>
            <p className="text-[11px] mb-3" style={{ color: "var(--text-faintest)" }}>
              {sample01kgValid
                ? `${sample01kgG} g of the formulation diluted into 0.1 L (~100 g) of finished beverage.`
                : "Enter a non-negative amount of solution above."}
            </p>

            <div className="flex items-baseline justify-between py-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <span className="text-sm" style={{ color: "var(--text)" }}>ppm flavor <span className="text-xs" style={{ color: "var(--text-faintest)" }}>(total, in beverage)</span></span>
              <span className="font-mono text-sm" style={{ color: "var(--accent)" }}>{(effectiveTotal * sample01kgFactor * 10000).toLocaleString(undefined, { maximumFractionDigits: 4 })} ppm</span>
            </div>

            <div className="space-y-0 mt-1">
              {sorted.map((c) => {
                const ing = ingMap[c.ingId];
                if (!ing) return null;
                return (
                  <div key={c._origIndex} className="flex items-baseline justify-between py-2" style={{ borderBottom: "1px dashed var(--border-faint)" }}>
                    <span className="text-sm flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                      {ing.name}
                      <span className="font-mono text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: "var(--border)", color: "var(--text-faint)" }}>ppm flavor component, in beverage</span>
                    </span>
                    <span className="font-mono text-sm shrink-0" style={{ color: "var(--accent)" }}>{(effectiveDosage(c.dosage, ing) * sample01kgFactor * 10000).toLocaleString(undefined, { maximumFractionDigits: 4 })} ppm</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Beverage dilution example: an independently editable gram amount is diluted into
              1 L (~1000 g) of finished beverage. g-of-ingredient-in-sample = dosage/100 * sample1kgG,
              so its ppm in the finished beverage = (dosage/100 * sample1kgG / 1000) * 1,000,000 = dosage * sample1kgFactor * 1,000. */}
          <div className="mt-6 pt-5" style={{ borderTop: "1px dashed var(--border)" }}>
            <div className="flex items-baseline gap-2 flex-wrap mb-1">
              <h3 className="font-mono text-[11px] tracking-[0.25em] uppercase" style={{ color: "var(--text-faint)" }}>
                Example — if
              </h3>
              <input
                type="number"
                min="0"
                step="any"
                value={sample1kgG}
                onChange={(e) => {
                  const v = e.target.value;
                  setSample1kgG(v === "" ? "" : parseFloat(v));
                }}
                className="font-mono text-sm text-right bg-transparent outline-none"
                style={{ color: "var(--accent)", border: "none", borderBottom: "1px dashed var(--border-strong)", width: 70, padding: "0 2px" }}
              />
              <h3 className="font-mono text-[11px] tracking-[0.25em] uppercase" style={{ color: "var(--text-faint)" }}>
                g solution is diluted in 1 L of beverage
              </h3>
            </div>
            <p className="text-[11px] mb-3" style={{ color: "var(--text-faintest)" }}>
              {sample1kgValid
                ? `${sample1kgG} g of the formulation diluted into 1 L (~1000 g) of finished beverage.`
                : "Enter a non-negative amount of solution above."}
            </p>

            <div className="flex items-baseline justify-between py-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <span className="text-sm" style={{ color: "var(--text)" }}>ppm flavor <span className="text-xs" style={{ color: "var(--text-faintest)" }}>(total, in beverage)</span></span>
              <span className="font-mono text-sm" style={{ color: "var(--accent)" }}>{(effectiveTotal * sample1kgFactor * 1000).toLocaleString(undefined, { maximumFractionDigits: 4 })} ppm</span>
            </div>

            <div className="space-y-0 mt-1">
              {sorted.map((c) => {
                const ing = ingMap[c.ingId];
                if (!ing) return null;
                return (
                  <div key={c._origIndex} className="flex items-baseline justify-between py-2" style={{ borderBottom: "1px dashed var(--border-faint)" }}>
                    <span className="text-sm flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                      {ing.name}
                      <span className="font-mono text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: "var(--border)", color: "var(--text-faint)" }}>ppm flavor component, in beverage</span>
                    </span>
                    <span className="font-mono text-sm shrink-0" style={{ color: "var(--accent)" }}>{(effectiveDosage(c.dosage, ing) * sample1kgFactor * 1000).toLocaleString(undefined, { maximumFractionDigits: 4 })} ppm</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6" style={{ borderTop: "1px solid var(--border)" }}>
          <h2 className="font-mono text-[11px] tracking-[0.25em] uppercase mb-3" style={{ color: "var(--accent)" }}>Notes</h2>
          <AutoGrowInput
            value={formulation.notes || ""}
            onChange={(v) => onUpdate({ notes: v })}
            placeholder="Add notes about this formulation…"
            className="w-full text-sm bg-transparent outline-none block p-3 rounded-md"
            style={{ color: "var(--text-muted)", border: "1px solid var(--border)", background: "var(--bg)", lineHeight: 1.6, fontFamily: "inherit" }}
          />
        </div>

        <button onClick={onDelete} className="mt-10 flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide" style={{ color: "var(--danger)" }}>
          <Trash2 size={13} /> remove formulation
        </button>
      </div>
    </div>
  );
}

// ---------- Compare view ----------
function CompareView({ formulations, ingMap, onBack, onOpenFormulation }) {
  // Build one row per distinct ingredient (plus ethanol) across all selected
  // formulations, so matching ingredients land on the same row regardless of
  // which column(s) they appear in. Rows are sorted by how many of the
  // selected formulations share that ingredient (most shared first), then
  // alphabetically, so overlap is immediately visible at the top.
  const rows = useMemo(() => {
    const rowMap = new Map(); // ingId -> { ing, dosagesByFormId: {} }

    formulations.forEach((f) => {
      f.components.forEach((c) => {
        const ing = ingMap[c.ingId];
        if (!ing) return;
        if (!rowMap.has(c.ingId)) {
          rowMap.set(c.ingId, { id: c.ingId, ing, dosagesByFormId: {} });
        }
        rowMap.get(c.ingId).dosagesByFormId[f.id] = c.dosage;
      });
      // ethanol remainder row, keyed separately from real ingredients
      const eth = ethanolPct(f.components);
      if (!rowMap.has("__ethanol__")) {
        rowMap.set("__ethanol__", { id: "__ethanol__", ing: ETHANOL, dosagesByFormId: {} });
      }
      rowMap.get("__ethanol__").dosagesByFormId[f.id] = eth;
    });

    const list = Array.from(rowMap.values());
    list.sort((a, b) => {
      const countA = Object.keys(a.dosagesByFormId).length;
      const countB = Object.keys(b.dosagesByFormId).length;
      if (countA !== countB) return countB - countA; // most-shared first
      if (a.id === "__ethanol__") return 1; // ethanol sinks to bottom within its tier
      if (b.id === "__ethanol__") return -1;
      return a.ing.name.localeCompare(b.ing.name);
    });
    return list;
  }, [formulations, ingMap]);

  const sharedCount = rows.filter((r) => r.id !== "__ethanol__" && Object.keys(r.dosagesByFormId).length > 1).length;

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-10">
      <button onClick={onBack} className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide mb-8" style={{ color: "var(--accent)" }}>
        <ChevronLeft size={14} /> back to bench
      </button>

      <header className="mb-8">
        <div className="font-mono text-xs tracking-[0.3em] uppercase mb-2" style={{ color: "var(--accent)" }}>side by side</div>
        <h1 className="font-display text-4xl md:text-5xl font-semibold leading-none mb-3">Compare formulations</h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {formulations.length} formulations · {sharedCount} shared ingredient{sharedCount === 1 ? "" : "s"} · dosages shown in g per 100 g batch
        </p>
      </header>

      <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full border-collapse" style={{ minWidth: 480 + formulations.length * 160 }}>
          <thead>
            <tr>
              <th
                className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider"
                style={{
                  background: "var(--surface)",
                  color: "var(--text-faintest)",
                  borderBottom: "1px solid var(--border)",
                  minWidth: 220,
                }}
              >
                Ingredient
              </th>
              {formulations.map((f) => (
                <th
                  key={f.id}
                  className="text-left px-4 py-3"
                  style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", borderLeft: "1px solid var(--border)", minWidth: 160 }}
                >
                  <button onClick={() => onOpenFormulation(f.id)} className="text-left">
                    <div className="font-display text-sm font-semibold leading-tight" style={{ color: "var(--text)" }}>{f.name}</div>
                    <div className="font-mono text-[9px] mt-0.5" style={{ color: "var(--text-faintest)" }}>
                      {flavorTotal(f.components).toFixed(2)} g flavor
                    </div>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const isShared = row.id !== "__ethanol__" && Object.keys(row.dosagesByFormId).length > 1;
              const isEthanol = row.id === "__ethanol__";
              return (
                <tr key={row.id} style={{ background: isShared ? "var(--surface-alt)" : "transparent" }}>
                  <td
                    className="px-4 py-2.5"
                    style={{
                      background: isShared ? "var(--surface-alt)" : (i % 2 === 0 ? "var(--bg)" : "var(--surface-alt2)"),
                      borderBottom: "1px solid var(--border-faint)",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm" style={{ color: isEthanol ? "var(--text-faint)" : "var(--text)" }}>{row.ing.name}</span>
                      {isShared && (
                        <span className="font-mono text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}>
                          shared
                        </span>
                      )}
                    </div>
                    {!isEthanol && (
                      <div className="mt-1">
                        <ClassPill classId={row.ing.class} />
                      </div>
                    )}
                  </td>
                  {formulations.map((f) => {
                    const dosage = row.dosagesByFormId[f.id];
                    return (
                      <td
                        key={f.id}
                        className="px-4 py-2.5 text-sm"
                        style={{
                          borderBottom: "1px solid var(--border-faint)",
                          borderLeft: "1px solid var(--border-faint)",
                          background: isShared ? "var(--surface-alt)" : "transparent",
                        }}
                      >
                        {dosage != null ? (
                          <>
                            <div style={{ color: "var(--text)" }}>{row.ing.name}</div>
                            <div className="font-mono" style={{ color: "var(--accent)" }}>{dosage} g</div>
                          </>
                        ) : (
                          <span className="font-mono" style={{ color: "var(--text-faintest)" }}>—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Top 20 view ----------
function Top20View({ formulations, onBack, onOpenFormulation }) {
  const ranked = useMemo(() => {
    return formulations
      .filter((f) => f.rating != null)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 20);
  }, [formulations]);

  const unrated = formulations.length - formulations.filter((f) => f.rating != null).length;

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-10">
      <button onClick={onBack} className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide mb-8" style={{ color: "var(--accent)" }}>
        <ChevronLeft size={14} /> back to bench
      </button>

      <header className="mb-8">
        <div className="font-mono text-xs tracking-[0.3em] uppercase mb-2" style={{ color: "var(--accent)" }}>leaderboard</div>
        <h1 className="font-display text-4xl md:text-5xl font-semibold leading-none mb-3">Top 20</h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {ranked.length} rated formulation{ranked.length === 1 ? "" : "s"}, highest first.
          {unrated > 0 && ` ${unrated} formulation${unrated === 1 ? "" : "s"} not yet rated.`}
        </p>
      </header>

      {ranked.length === 0 ? (
        <div className="text-center py-20" style={{ color: "var(--text-faintest)" }}>
          <Trophy size={28} className="mx-auto mb-3" />
          <p className="font-display text-lg">No ratings yet.</p>
          <p className="text-sm mt-1">Open a formulation and set a rating from 0.1 to 10.0.</p>
        </div>
      ) : (
        <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {ranked.map((f, i) => (
            <button
              key={f.id}
              onClick={() => onOpenFormulation(f.id)}
              className="w-full text-left flex items-center gap-4 px-4 py-3"
              style={{
                background: i % 2 === 0 ? "var(--bg)" : "var(--surface-alt2)",
                borderTop: i > 0 ? "1px solid var(--border-faint)" : "none",
              }}
            >
              <span
                className="font-display text-lg font-semibold shrink-0 text-center"
                style={{ width: 28, color: i < 3 ? "var(--accent)" : "var(--text-faintest)" }}
              >
                {i + 1}
              </span>
              <div
                className="shrink-0 rounded-full overflow-hidden flex items-center justify-center"
                style={{ width: 34, height: 34, background: "var(--bg)", border: "1px solid var(--border)" }}
              >
                {f.image ? (
                  <img src={f.image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <FlaskConical size={16} style={{ color: "var(--accent)" }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{f.name}</div>
                <div className="text-xs truncate" style={{ color: "var(--text-faint)" }}>{f.subtitle}</div>
              </div>
              <span className="flex items-center gap-1 font-mono text-sm shrink-0" style={{ color: "var(--accent)" }}>
                <Star size={13} fill="var(--accent)" /> {f.rating.toFixed(1)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- New formulation form ----------
function NewFormulationForm({ ingredients, onCancel, onSave }) {
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [author, setAuthor] = useState("");
  const [authorLink, setAuthorLink] = useState("");
  const [notes, setNotes] = useState("");
  const [components, setComponents] = useState([{ ingId: "", dosage: "" }]);
  const [pickerOpenIdx, setPickerOpenIdx] = useState(null);
  const [pickerQuery, setPickerQuery] = useState("");

  const total = components.reduce((s, c) => s + (parseFloat(c.dosage) || 0), 0);
  const eth = Math.max(0, 100 - total);
  const overLimit = total > 100;
  const canSave = name.trim() && components.some((c) => c.ingId && c.dosage) && !overLimit;
  const filteredPicker = ingredients.filter((i) => i.name.toLowerCase().includes(pickerQuery.toLowerCase()));

  return (
    <div className="max-w-2xl mx-auto px-5 md:px-8 py-10">
      <button onClick={onCancel} className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide mb-8" style={{ color: "var(--accent)" }}>
        <ChevronLeft size={14} /> cancel
      </button>
      <h1 className="font-display text-4xl font-semibold mb-8">New formulation</h1>
      <div className="space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Peach Accord No. 3" style={inputStyle} /></Field>
          <Field label="Subtitle"><input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Short description" style={inputStyle} /></Field>
          <Field label="Formulated by"><input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Name (optional)" style={inputStyle} /></Field>
          <Field label="Source link"><input value={authorLink} onChange={(e) => setAuthorLink(e.target.value)} placeholder="https:// (optional)" style={inputStyle} /></Field>
        </div>

        <Field label={`Components — ${total.toFixed(2)} g flavor, ${eth.toFixed(2)} g ethanol, 100 g total`}>
          {overLimit && (
            <div className="mb-3 p-3 rounded-md text-sm flex gap-2" style={{ background: "var(--danger-bg)", color: "var(--danger-text)", border: "1px solid var(--danger)55" }}>
              <AlertTriangle size={16} className="shrink-0 mt-0.5" style={{ color: "var(--danger)" }} />
              Components total {total.toFixed(2)} g, over 100 g. Reduce dosages before saving.
            </div>
          )}
          <div className="space-y-3">
            {components.map((c, idx) => {
              const ing = ingredients.find((i) => i.id === c.ingId);
              return (
                <div key={idx} className="p-3 rounded-md relative" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <div className="flex gap-2 items-center">
                    <button onClick={() => { setPickerOpenIdx(pickerOpenIdx === idx ? null : idx); setPickerQuery(""); }} className="flex-1 text-left px-3 py-2 rounded text-sm" style={{ background: "var(--bg)", border: "1px solid var(--border)", color: ing ? "var(--text)" : "var(--text-faintest)" }}>
                      {ing ? ing.name : "Select a material…"}
                    </button>
                    <input value={c.dosage} onChange={(e) => setComponents((prev) => prev.map((p, i) => (i === idx ? { ...p, dosage: e.target.value } : p)))} placeholder="0.00 g" className="w-24" style={inputStyle} />
                    <button onClick={() => setComponents((prev) => prev.filter((_, i) => i !== idx))} style={{ color: "var(--danger)" }}><Trash2 size={16} /></button>
                  </div>
                  {ing && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      <ClassPill classId={ing.class} /><NotePill note={ing.note} />
                      {ing.descriptors.slice(0, 3).map((d) => <DescPill key={d} desc={d} />)}
                    </div>
                  )}
                  {pickerOpenIdx === idx && (
                    <div className="absolute z-10 left-0 right-0 mt-1 rounded-md overflow-hidden max-h-64 overflow-y-auto" style={{ background: "var(--surface-sunken)", border: "1px solid var(--border)" }}>
                      <input autoFocus value={pickerQuery} onChange={(e) => setPickerQuery(e.target.value)} placeholder="Search materials…" className="w-full px-3 py-2 text-sm outline-none" style={{ background: "var(--bg)", color: "var(--text)", borderBottom: "1px solid var(--border)" }} />
                      {filteredPicker.map((opt) => (
                        <button key={opt.id} onClick={() => { setComponents((prev) => prev.map((p, i) => (i === idx ? { ...p, ingId: opt.id } : p))); setPickerOpenIdx(null); }} className="w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-white/5" style={{ color: "var(--text)" }}>
                          <span>{opt.name}</span><ClassPill classId={opt.class} />
                        </button>
                      ))}
                      {filteredPicker.length === 0 && <div className="px-3 py-2 text-sm" style={{ color: "var(--text-faintest)" }}>No materials match.</div>}
                    </div>
                  )}
                </div>
              );
            })}
            <button onClick={() => setComponents((prev) => [...prev, { ingId: "", dosage: "" }])} className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide" style={{ color: "var(--accent)" }}>
              <Plus size={14} /> add component
            </button>

            <div className="p-3 rounded-md flex items-center justify-between" style={{ background: "var(--bg)", border: "1px dashed var(--border)" }}>
              <span className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
                {ETHANOL.name}
                <span className="font-mono text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: "var(--border)", color: "var(--text-faint)" }}>remainder</span>
              </span>
              <span className="font-mono text-sm" style={{ color: "var(--accent)" }}>{eth.toFixed(2)} g</span>
            </div>
          </div>
        </Field>

        <Field label="Bench notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Stability, dosage warnings, trial results…" rows={3} style={{ ...inputStyle, resize: "vertical" }} />
        </Field>

        <button
          disabled={!canSave}
          onClick={() => onSave({ name, subtitle, author, authorLink, notes, components: components.filter((c) => c.ingId && c.dosage).map((c) => ({ ingId: c.ingId, dosage: parseFloat(c.dosage) })) })}
          className="px-5 py-3 rounded-md font-medium text-sm"
          style={{ background: canSave ? "var(--accent)" : "var(--border)", color: canSave ? "var(--accent-contrast)" : "var(--text-faintest)", cursor: canSave ? "pointer" : "not-allowed" }}
        >
          Save formulation
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block font-mono text-[10px] tracking-[0.25em] uppercase mb-2" style={{ color: "var(--text-faintest)" }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 6, background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 14, outline: "none" };
