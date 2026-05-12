// Initial photo upload. When imageAtom is null, this fills the editor;
// otherwise the Canvas takes over. Plain DOM file APIs — no Effect needed
// at this leaf (FileReader fails are rare and the recovery is "try again").
import { useState } from "react";
import { useAtomSet } from "@effect-atom/atom-react";
import { imageAtom, type LoadedImage } from "../store/editor-store";

export function DropZone() {
  const setImage = useAtomSet(imageAtom);
  const [error, setError] = useState<string | null>(null);
  const [isOver, setIsOver] = useState(false);

  const handleFile = (file: File) => {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("That doesn't look like an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result);
      const img = new Image();
      img.onload = () => {
        const loaded: LoadedImage = {
          src,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
        };
        setImage(loaded);
      };
      img.onerror = () => setError("Failed to decode the image.");
      img.src = src;
    };
    reader.onerror = () => setError("Failed to read the file.");
    reader.readAsDataURL(file);
  };

  return (
    <label
      className={`flex flex-1 cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed transition ${
        isOver
          ? "border-[#fc5200] bg-[#fc5200]/10 text-white"
          : "border-neutral-700 bg-neutral-900 text-neutral-400 hover:border-neutral-500"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      }}
    >
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <span className="text-2xl">📷</span>
      <div className="text-center">
        <p className="text-base font-medium">Drop a photo here</p>
        <p className="mt-1 text-sm">or click to browse · JPG, PNG, HEIC</p>
        <p className="mt-3 text-xs text-neutral-500">
          The PNG you export will match this photo's native resolution exactly.
        </p>
      </div>
      {error && (
        <p className="rounded bg-red-900/40 px-3 py-1.5 text-sm text-red-200">
          {error}
        </p>
      )}
    </label>
  );
}
