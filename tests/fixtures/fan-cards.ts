import type { FanCard } from "../../src/domain/fan-cards";
export const vinFanCard: FanCard = {
  id: "5086888e-aee5-4295-8bd9-f9f1dafbb718",
  name: "Vin D. Ny, el DJ del Caos",
  display_number: "OP-001",
  edition_code: "fan-pirate-gods",
  artwork_id: "vin-d-ny",
  created_at: "2026-10-16T00:00:00Z",
};
export const vinFanImageHash =
  "29077766c5a6acf8c36fd5ddbda71ff6bfc1ab1d2bfaa6a6a6a262d7245fa375";

export const marioFanCard: FanCard = {
  id: "36e3be70-e149-483c-806e-94e78edcf9dd",
  name: "Mario D. Bestia, el Destructor",
  display_number: "LDP-002",
  edition_code: "fan-pirate-gods",
  artwork_id: "mario-d-bestia",
  created_at: "2026-10-16T00:00:00Z",
};
export const marioFanImageHash =
  "ead25b5c18669c8bc3fb096178351f7912375a42e587795cbbd058a1ae05773f";
export const aarFanCard: FanCard = {
  id: "a8e7d1f8-62d5-48f6-9a39-1f7f6cf91d42",
  name: "Aar D. On, el Dios de la Guerra",
  display_number: "LDP-003",
  edition_code: "fan-pirate-gods",
  artwork_id: "aar-d-on",
  created_at: "2026-10-16T00:00:00Z",
};
export const aarFanImageHash =
  "76afefb98640beac8de80bf9625c30f392a458b78dda257edc7a9e783713a752";
export const christianFanCard: FanCard = {
  id: "eaf31cf6-f972-4b9e-a8df-c6d7c3db0904",
  name: "Christian D. Bermejo, el Verdugo del Eclipse",
  display_number: "LDP-004",
  edition_code: "fan-pirate-gods",
  artwork_id: "christian-d-bermejo",
  created_at: "2026-10-16T00:00:00Z",
};
export const christianFanImageHash =
  "bbbf2b8aec4434eb7dad1e93d11f28c1ea0eefb53eaf53fe182d65faad4ac9be";
export const jaimeFanCard: FanCard = {
  id: "d26d3b48-7e0c-4c72-b274-9c99e3ab7a05",
  name: "Jaime D. Dragneel, el Guardián de las Llamas",
  display_number: "LDP-005",
  edition_code: "fan-pirate-gods",
  artwork_id: "jaime-d-dragneel",
  created_at: "2026-10-16T00:00:00Z",
};
export const jaimeFanImageHash =
  "954f6cfbecc41c167d449160e4760ee905c08ad50e531a4328d59475475e155a";
export const joanFanCard: FanCard = {
  id: "a254ffb8-c517-409e-872a-9f14a4388306",
  name: "Joan D. Cuadras, el Oráculo de los Dioses",
  display_number: "LDP-006",
  edition_code: "fan-pirate-gods",
  artwork_id: "joan-d-cuadras",
  created_at: "2026-10-16T00:00:00Z",
};
export const joanFanImageHash =
  "f351f0575f7ff5d60d2d4171a01a337d56f6cbac14b55e3e293730a0b9a8b926";
export const suFanCard: FanCard = {
  id: "d515ca79-15ba-4f9f-b730-d5fba7f27a07",
  name: "Su D. Yoyi, el Dios de Dioses",
  display_number: "LDP-007",
  edition_code: "fan-pirate-gods",
  artwork_id: "su-d-yoyi",
  created_at: "2026-10-16T00:00:00Z",
};
export const suFanImageHash =
  "c7d29c881a6f6da1ba7ed67e508c21de57906ed4adb3fd24a45a9e09c88ea294";
export const fanCardFixtures = [
  { card: vinFanCard, imageHash: vinFanImageHash, width: 916 },
  { card: marioFanCard, imageHash: marioFanImageHash, width: 912 },
  { card: aarFanCard, imageHash: aarFanImageHash, width: 914 },
  { card: christianFanCard, imageHash: christianFanImageHash, width: 960 },
  { card: jaimeFanCard, imageHash: jaimeFanImageHash, width: 914 },
  { card: joanFanCard, imageHash: joanFanImageHash, width: 960 },
  { card: suFanCard, imageHash: suFanImageHash, width: 914 },
] as const;
