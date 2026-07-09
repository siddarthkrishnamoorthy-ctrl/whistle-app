"use client";

import { useState } from "react";
import { Modal, ModalFooter } from "@/components/modal";
import { Field, SelectField, TextareaField } from "@/components/ui";
import { useApiList } from "@/lib/hooks";
import { apiUploadImage, assetUrl } from "@/lib/api-client";
import type { SkillLevel, Sport } from "@/lib/types";
import { AGE_GROUPS } from "@whistle/shared";

export interface CreateDrillPayload {
  title: string;
  sportKey: string;
  skillCategory?: string;
  ageGroups?: string[];
  level?: SkillLevel;
  durationMin?: number;
  equipment?: string[];
  description?: string;
  media?: { type: "video" | "diagram"; url: string }[];
}

export function NewDrillModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (dto: CreateDrillPayload) => Promise<void>;
}) {
  const { data: sports } = useApiList<Sport>("/sports");

  const [title, setTitle] = useState("");
  const [sportKey, setSportKey] = useState("");
  const [skillCategory, setSkillCategory] = useState("");
  const [ageGroups, setAgeGroups] = useState<string[]>([]);
  const [level, setLevel] = useState<SkillLevel>("beginner");
  const [durationMin, setDurationMin] = useState("10");
  const [equipment, setEquipment] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle("");
    setSportKey("");
    setSkillCategory("");
    setAgeGroups([]);
    setLevel("beginner");
    setDurationMin("10");
    setEquipment("");
    setDescription("");
    setVideoUrl("");
    setImageUrl(null);
    setError(null);
  }

  function toggleAgeGroup(group: string) {
    setAgeGroups((prev) => (prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]));
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setError(null);
    try {
      const { url } = await apiUploadImage(file);
      setImageUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload image.");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  }

  async function handleSubmit() {
    if (!title.trim() || !sportKey) {
      setError("Title and Sport are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const media: { type: "video" | "diagram"; url: string }[] = [];
      if (videoUrl.trim()) media.push({ type: "video", url: videoUrl.trim() });
      if (imageUrl) media.push({ type: "diagram", url: imageUrl });

      await onCreated({
        title: title.trim(),
        sportKey,
        skillCategory: skillCategory || undefined,
        ageGroups: ageGroups.length > 0 ? ageGroups : undefined,
        level,
        durationMin: durationMin ? Number(durationMin) : undefined,
        equipment: equipment
          ? equipment.split(",").map((e) => e.trim()).filter(Boolean)
          : undefined,
        description: description || undefined,
        media: media.length > 0 ? media : undefined,
      });
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create drill.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="New Drill"
      subtitle="Add a drill to the bank"
      wide
      footer={
        <ModalFooter
          onCancel={() => {
            reset();
            onClose();
          }}
          onSubmit={handleSubmit}
          submitLabel="Add Drill"
          submitting={submitting}
        />
      }
    >
      <Field label="Title *" placeholder="e.g. Backfoot Defence" value={title} onChange={(e) => setTitle(e.target.value)} />

      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Sport *" value={sportKey} onChange={(e) => setSportKey(e.target.value)}>
          <option value="">Select a sport…</option>
          {sports.map((s) => (
            <option key={s.key} value={s.key}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <Field
          label="Skill / category"
          placeholder="e.g. Batting"
          value={skillCategory}
          onChange={(e) => setSkillCategory(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Level" value={level} onChange={(e) => setLevel(e.target.value as SkillLevel)}>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
          <option value="elite">Elite</option>
        </SelectField>
        <Field
          label="Duration (min)"
          type="number"
          min={1}
          value={durationMin}
          onChange={(e) => setDurationMin(e.target.value)}
        />
      </div>

      <div>
        <span className="mb-1.5 block text-sm text-text-secondary">Age groups</span>
        <div className="flex flex-wrap gap-2">
          {AGE_GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => toggleAgeGroup(g)}
              className={`rounded-full border px-3 py-1 text-xs ${
                ageGroups.includes(g) ? "border-accent bg-accent text-accent-text" : "border-border text-text-secondary"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <Field
        label="Equipment (comma-separated)"
        placeholder="e.g. cones, balls, ladders"
        value={equipment}
        onChange={(e) => setEquipment(e.target.value)}
      />

      <TextareaField
        label="Description & objective"
        rows={3}
        placeholder="Purpose and expected outcome…"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Video link"
          placeholder="https://…"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
        />
        <label className="block">
          <span className="mb-1.5 block text-sm text-text-secondary">Diagram / image</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleImageSelect}
            disabled={uploadingImage}
            className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-full file:border-0 file:bg-surface-alt file:px-3 file:py-1.5 file:text-xs file:text-text-primary hover:file:bg-border"
          />
        </label>
      </div>

      {uploadingImage && <p className="text-xs text-text-muted">Uploading image…</p>}
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={assetUrl(imageUrl)} alt="Drill diagram preview" className="h-24 rounded-md border border-border object-cover" />
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </Modal>
  );
}
