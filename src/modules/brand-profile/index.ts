import type { RowDataPacket } from "mysql2/promise";
import { queryRows } from "@/core/db";

export const brandProfiles = [
  {
    slug: "jojo",
    code: "JOJO",
    name: "Jojo",
    description:
      "Brand kuliner dan hospitality dengan fokus pada pengalaman pelanggan yang hangat.",
    mark: "J",
    wordmark: "JOJO",
    shape: "50% 50% 43% 57% / 44% 46% 54% 56%",
    surface:
      "radial-gradient(ellipse at 30% 20%, #ffe9d6 0%, #e8a082 42%, #a95446 100%)",
    objectText: "text-white",
    colors: "bg-[#f3d9cb] text-[#8b3e31]",
    motif: "border-[#8b3e31]/30",
  },
  {
    slug: "jly",
    code: "JLY",
    name: "JLY",
    description:
      "Brand dengan portofolio produk dan layanan yang terus berkembang bersama tim terbaik.",
    mark: "J",
    wordmark: "JLY",
    shape: "30% 30% 18% 18% / 28% 28% 15% 15%",
    surface:
      "radial-gradient(ellipse at 30% 18%, #eff6d3 0%, #a8c18c 43%, #526b48 100%)",
    objectText: "text-white",
    colors: "bg-[#dfe8d5] text-[#526b48]",
    motif: "border-[#526b48]/30",
  },
  {
    slug: "guulak",
    code: "GUULAK",
    name: "Guulak",
    description:
      "Produk kuliner dengan karakter dan kualitas yang konsisten.",
    mark: "G",
    wordmark: "GUULAK",
    shape: "50% 50% 46% 54% / 42% 42% 58% 58%",
    surface:
      "radial-gradient(ellipse at 30% 18%, #f0e5ff 0%, #ae95d8 42%, #66528c 100%)",
    objectText: "text-white",
    colors: "bg-[#ded9ef] text-[#534579]",
    motif: "border-[#534579]/30",
  },
  {
    slug: "ana",
    code: "ANA",
    name: "Ana",
    description:
      "Brand bakery yang mengutamakan rasa, kualitas, dan pelayanan sehari-hari.",
    mark: "A",
    wordmark: "ANA",
    shape: "50% 50% 18% 18% / 56% 56% 18% 18%",
    surface:
      "radial-gradient(ellipse at 32% 18%, #fff4c4 0%, #e7bb5c 44%, #a96d2b 100%)",
    objectText: "text-[#70491b]",
    colors: "bg-[#f1e4b7] text-[#866b2d]",
    motif: "border-[#866b2d]/30",
  },
  {
    slug: "mutiara",
    code: "MUTIARA",
    name: "Mutiara",
    description:
      "Brand yang bertumbuh melalui kolaborasi, operasional yang rapi, dan kepedulian pada pelanggan.",
    mark: "M",
    wordmark: "MUTIARA",
    shape: "50%",
    surface:
      "radial-gradient(ellipse at 30% 18%, #e0fff7 0%, #82c5b8 43%, #386d64 100%)",
    objectText: "text-white",
    colors: "bg-[#d7e8e4] text-[#42685e]",
    motif: "border-[#42685e]/30",
  },
] as const;

interface BrandLocationRow extends RowDataPacket {
  id: number;
  code: string;
  name: string;
  description: string | null;
  location_id: number | null;
  location_name: string | null;
  city: string | null;
  address: string | null;
}

export async function getPublicBrandProfile(slug: string) {
  const definition = brandProfiles.find((brand) => brand.slug === slug);
  if (!definition) return null;

  const rows = await queryRows<BrandLocationRow>(
    `SELECT b.id, b.code, b.name, b.description,
            l.id AS location_id, l.name AS location_name, l.city, l.address
     FROM brands b
     LEFT JOIN locations l ON l.brand_id = b.id AND l.is_active = 1
     WHERE b.code = ? AND b.is_active = 1
     ORDER BY l.city, l.name`,
    [definition.code],
  );

  if (rows.length === 0) return null;

  const firstRow = rows[0];
  return {
    ...definition,
    name: firstRow.name,
    description: firstRow.description?.trim() || definition.description,
    branches: rows.flatMap((row) =>
      row.location_id === null || row.location_name === null
        ? []
        : [
            {
              id: row.location_id,
              name: row.location_name,
              city: row.city,
              address: row.address,
            },
          ],
    ),
  };
}
