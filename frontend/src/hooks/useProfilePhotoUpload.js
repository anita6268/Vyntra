import { useCallback, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import toast from "react-hot-toast";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export function useProfilePhotoUpload() {
  const { updateProfile } = useAuthStore();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState(null);
  const [editorSrc, setEditorSrc] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const validateFile = useCallback((file) => {
    if (!file) return "No file selected.";
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return "Invalid image type. Please select a JPG, PNG or WebP image.";
    }
    if (file.size > MAX_IMAGE_SIZE) {
      return "Image is too large. Maximum size is 5MB.";
    }
    return null;
  }, []);

  const readFileAsDataUrl = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Failed to read image file."));
    });
  }, []);

  const openEditor = useCallback(async (file) => {
    const validationError = validateFile(file);
    if (validationError) {
      toast.error(validationError);
      setError(validationError);
      return;
    }

    setError(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setEditorSrc(dataUrl);
      setEditorOpen(true);
    } catch (err) {
      const msg = err.message || "Failed to read image file.";
      toast.error(msg);
      setError(msg);
    }
  }, [validateFile, readFileAsDataUrl]);

  const closeEditor = useCallback(() => {
    setEditorOpen(false);
    setEditorSrc(null);
    setError(null);
  }, []);

  const saveEditorResult = useCallback(async (editedDataUrl) => {
    setError(null);
    setUploading(true);
    try {
      const result = await updateProfile({ profilePic: editedDataUrl });
      if (result) {
        setPreviewUrl(editedDataUrl);
        toast.success("Profile photo updated");
      }
    } catch {
      const msg = "Failed to upload profile photo.";
      toast.error(msg);
      setError(msg);
    } finally {
      setUploading(false);
      setEditorOpen(false);
      setEditorSrc(null);
    }
  }, [updateProfile]);

  const clearPreview = useCallback(() => {
    setPreviewUrl(null);
    setError(null);
  }, []);

  return {
    uploading,
    previewUrl,
    error,
    editorSrc,
    editorOpen,
    openEditor,
    closeEditor,
    saveEditorResult,
    clearPreview,
    validateFile,
  };
}
