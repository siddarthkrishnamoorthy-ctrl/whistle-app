"use client";

import { useCallback, useEffect, useState } from "react";
import { apiJson } from "@/lib/api-client";
import { Card, EmptyState, Field, Table } from "@/components/ui";
import { Modal, ModalFooter } from "@/components/modal";

// geoLat/geoLng are Prisma Decimals — they arrive as strings over JSON.
interface Center {
  id: string;
  name: string;
  address?: string | null;
  geoLat?: number | string | null;
  geoLng?: number | string | null;
  geoRadiusM?: number | null;
}

// Pull coordinates out of any Google Maps link the user pastes:
//   .../@12.9716,77.5946,17z   (map viewport)
//   ...?q=12.9716,77.5946      (search pin)
//   ...!3d12.9716!4d77.5946    (place details)
function parseMapsUrl(url: string): { lat: number; lng: number } | null {
  const at = url.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  const q = url.match(/[?&](?:q|ll|query)=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/);
  const bang = url.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/);
  const m = bang ?? q ?? at;
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Number.isNaN(lat) || Number.isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export default function CentersPage() {
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Center | null>(null);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [radius, setRadius] = useState("150");
  const [submitting, setSubmitting] = useState(false);

  const coords = parseMapsUrl(mapsUrl);

  const refetch = useCallback(() => {
    apiJson<Center[]>("/centers")
      .then(setCenters)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load centers."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(refetch, [refetch]);

  function openModal(center?: Center) {
    setEditing(center ?? null);
    setName(center?.name ?? "");
    setAddress(center?.address ?? "");
    setMapsUrl(
      center?.geoLat != null && center?.geoLng != null ? `https://www.google.com/maps?q=${center.geoLat},${center.geoLng}` : ""
    );
    setRadius(String(center?.geoRadiusM ?? 150));
    setModalOpen(true);
  }

  async function save() {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const body = {
        name: name.trim(),
        address: address.trim() || undefined,
        geoLat: coords?.lat,
        geoLng: coords?.lng,
        geoRadiusM: coords ? Math.min(2000, Math.max(10, Number(radius) || 150)) : undefined,
      };
      if (editing) {
        await apiJson(`/centers/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await apiJson("/centers", { method: "POST", body: JSON.stringify(body) });
      }
      setModalOpen(false);
      refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save center.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Centers</h1>
          <p className="text-sm text-text-secondary">
            Your venues — the pinned location powers coach check-in (they must be at the center to start a session)
          </p>
        </div>
        <button
          onClick={() => openModal()}
          className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-text hover:opacity-90"
        >
          + Add Center
        </button>
      </div>

      {error && <Card className="text-sm text-danger">{error}</Card>}

      {loading ? (
        <Card className="text-sm text-text-secondary">Loading…</Card>
      ) : centers.length === 0 ? (
        <Card>
          <EmptyState message="No centers yet. Add your first venue with its Google Maps pin." />
        </Card>
      ) : (
        <Table columns={["Center", "Address", "Map location", "Check-in radius", ""]}>
          {centers.map((c) => (
            <tr key={c.id}>
              <td className="px-4 py-3 font-medium text-text-primary">{c.name}</td>
              <td className="px-4 py-3 text-text-secondary">{c.address ?? "—"}</td>
              <td className="px-4 py-3">
                {c.geoLat != null && c.geoLng != null ? (
                  <a
                    href={`https://www.google.com/maps?q=${c.geoLat},${c.geoLng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-accent hover:underline"
                  >
                    📍 {Number(c.geoLat).toFixed(5)}, {Number(c.geoLng).toFixed(5)}
                  </a>
                ) : (
                  <span className="text-sm text-text-secondary">not pinned</span>
                )}
              </td>
              <td className="px-4 py-3 text-text-secondary">{c.geoLat != null ? `${c.geoRadiusM ?? 150} m` : "—"}</td>
              <td className="px-4 py-3 text-right">
                <button onClick={() => openModal(c)} className="text-sm font-semibold text-accent hover:underline">
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Center" : "Add Center"}
        subtitle="Paste a Google Maps link to pin the exact venue location"
        footer={
          <ModalFooter
            onCancel={() => setModalOpen(false)}
            onSubmit={save}
            submitLabel={editing ? "Save Changes" : "Add Center"}
            submitting={submitting}
          />
        }
      >
        <Field label="Center name *" value={name} onChange={(e) => setName(e.target.value)} />
        <Field label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
        <Field
          label="Google Maps link"
          placeholder="Paste a maps.google.com link for the venue"
          value={mapsUrl}
          onChange={(e) => setMapsUrl(e.target.value)}
        />
        <p className="text-xs text-text-secondary">
          <a
            href={coords ? `https://www.google.com/maps?q=${coords.lat},${coords.lng}` : "https://www.google.com/maps"}
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            Open Google Maps ↗
          </a>{" "}
          — find the venue, copy the link from the address bar (or Share → Copy link) and paste it above.
        </p>
        {mapsUrl.trim() &&
          (coords ? (
            <p className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-xs text-success">
              ✓ Location picked: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </p>
          ) : (
            <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
              Couldn&apos;t read coordinates from that link yet — open the exact place in Google Maps first, then copy
              the full browser URL.
            </p>
          ))}
        {coords && (
          <Field
            label="Check-in radius (metres) — how close a coach must be"
            type="number"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
          />
        )}
      </Modal>
    </div>
  );
}
