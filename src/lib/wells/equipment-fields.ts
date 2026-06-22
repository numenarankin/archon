/**
 * The standard equipment / wellbore spec fields, in sheet order (pump &
 * perforations → tubing → rods → casing → well → surface unit → other). These
 * are seeded as empty rows when a well has no equipment yet, so the user lands
 * on the familiar spec sheet and just fills in values; they can also add their
 * own rows for anything not listed here.
 *
 * Labels with a repeated base name (Depth, Rods, #) are disambiguated so each
 * field is distinct.
 */
export const DEFAULT_EQUIPMENT_LABELS: readonly string[] = [
  // Pump & perforations
  "Tbg Pump",
  "SN",
  "Perfs",
  // Tubing
  "Top jt",
  "Tbg",
  "#jts",
  "Tubing Depth",
  "Tbg Anchor",
  "Tbg Tstd",
  "Scanned",
  "Tallied",
  // Rods
  "PR",
  "PRL",
  "Rod Subs",
  "Rods 7/8",
  "Rods 7/8 #",
  "Rods 3/4",
  "Rods 3/4 #",
  "Kbars",
  // Casing
  "Casing",
  "Casing Depth",
  "Plug Back",
  "TOC",
  "Surface",
  "Surface Depth",
  // Well
  "Drilled",
  "RKB",
  // Surface unit
  "Unit",
  "Bridle",
  "Torque",
  "Motor",
  "Sheave",
  "Belts",
  "Well Test",
  // Other
  "Pump Capacity",
  "Note",
];
