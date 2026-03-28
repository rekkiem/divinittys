'use client';
/**
 * ImageUploader — drag-and-drop image upload component.
 * Uploads to /api/admin/upload → MinIO → returns public URL.
 *
 * Handles 401/403 by prompting re-login (stale Zustand token after DB reset).
 */
import { useCallback, useState } from 'react';
import Image from 'next/image';
import { Upload, X, Star, Loader2, ImageIcon, AlertCircle, LogIn } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

type UploadedImage = { url: string; isMain: boolean; id?: string };

type ImageUploaderProps = {
  productId?: string;
  initialImages?: UploadedImage[];
  onImagesChange?: (images: UploadedImage[]) => void;
  maxImages?: number;
};

export default function ImageUploader({
  productId,
  initialImages = [],
  onImagesChange,
  maxImages = 8,
}: ImageUploaderProps) {
  const [images, setImages]       = useState<UploadedImage[]>(initialImages);
  const [dragging, setDragging]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { accessToken, logout }   = useAuthStore();
  const router = useRouter();

  const notify = (next: UploadedImage[]) => {
    setImages(next);
    onImagesChange?.(next);
  };

  const uploadFile = async (file: File, isMain = false): Promise<string> => {
    const fd = new FormData();
    fd.append('file', file);
    if (productId) fd.append('productId', productId);
    fd.append('isMain', String(isMain));

    const headers: Record<string, string> = {};
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

    const res  = await fetch('/api/admin/upload', {
      method: 'POST', headers, credentials: 'include', body: fd,
    });
    const data = await res.json();

    if (res.status === 401 || res.status === 403) {
      // Stale token or session expired — force re-login
      const code = data.code;
      if (code === 'NO_TOKEN' || code === 'INVALID_TOKEN' || code === 'USER_NOT_FOUND') {
        setAuthError(true);
        throw new Error('auth_required');
      }
      throw new Error(data.error || `Error ${res.status}`);
    }

    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data.url as string;
  };

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadError(null);
    setAuthError(false);

    if (images.length + files.length > maxImages) {
      toast.error(`Máximo ${maxImages} imágenes por producto`);
      return;
    }

    setUploading(true);
    const added: UploadedImage[] = [];

    for (const file of Array.from(files)) {
      try {
        const isMain = images.length === 0 && added.length === 0;
        const url = await uploadFile(file, isMain);
        added.push({ url, isMain });
      } catch (e: any) {
        if (e.message === 'auth_required') break; // stop on auth error
        setUploadError(e.message);
        toast.error(`Error en ${file.name}: ${e.message}`);
      }
    }

    if (added.length) {
      const next = [...images, ...added];
      notify(next);
      toast.success(`${added.length} imagen${added.length > 1 ? 'es subidas' : ' subida'} ✓`);
    }
    setUploading(false);
  }, [images, productId, accessToken, maxImages]);

  const handleReLogin = async () => {
    await logout();
    router.push('/cuenta/login?redirect=' + encodeURIComponent(window.location.pathname));
  };

  const setMain = (idx: number) => notify(images.map((img, i) => ({ ...img, isMain: i === idx })));
  const remove  = (idx: number) => notify(images.filter((_, i) => i !== idx));

  const isMinioUrl = (url: string) =>
    url.includes(':9000') || url.includes('/imagenes/') || url.includes('/products/');

  // ── Auth error state ─────────────────────────────────────────────
  if (authError) {
    return (
      <div className="border-2 border-dashed border-red-300 rounded-2xl p-8 bg-red-50 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
        <div>
          <p className="font-sans font-semibold text-red-700 mb-1">Sesión desactualizada</p>
          <p className="font-sans text-sm text-red-500">
            Tu sesión puede haber expirado o la base de datos fue reiniciada.
            Debes volver a iniciar sesión para subir imágenes.
          </p>
        </div>
        <button
          type="button"
          onClick={handleReLogin}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-sans font-semibold hover:bg-red-600 transition-colors"
        >
          <LogIn className="w-4 h-4" />
          Ir a iniciar sesión
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <label
        onDragOver={e  => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e      => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-8 cursor-pointer transition-all ${
          uploading ? 'pointer-events-none opacity-60' :
          dragging  ? 'border-primary-400 bg-primary-50 scale-[1.01]' :
                      'border-champagne-300 hover:border-primary-300 hover:bg-champagne-50'
        }`}
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
          disabled={uploading}
        />
        {uploading ? (
          <>
            <Loader2 className="w-8 h-8 text-primary-400 animate-spin mb-2" />
            <p className="font-sans text-sm text-charcoal-500">Subiendo a MinIO...</p>
          </>
        ) : (
          <>
            <Upload className="w-8 h-8 text-primary-400 mb-2" />
            <p className="font-sans text-sm font-medium text-charcoal-600">
              Arrastra imágenes aquí o haz clic
            </p>
            <p className="font-sans text-xs text-charcoal-400 mt-1">
              JPEG · PNG · WebP · GIF — máx. 5MB — hasta {maxImages} imágenes
            </p>
          </>
        )}
      </label>

      {/* Error banner */}
      {uploadError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-red-600">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <p className="font-sans text-sm">{uploadError}</p>
        </div>
      )}

      {/* Preview grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {images.map((img, idx) => (
            <div key={`${img.url}-${idx}`} className="relative group aspect-square">
              <div className={`w-full h-full rounded-xl overflow-hidden border-2 bg-champagne-50 ${
                img.isMain ? 'border-primary-400' : 'border-champagne-200'
              }`}>
                {img.url ? (
                  <Image
                    src={img.url}
                    alt={`Imagen ${idx + 1}`}
                    fill sizes="120px"
                    className="object-cover"
                    unoptimized={isMinioUrl(img.url)}
                    onError={e => { (e.target as HTMLImageElement).src = '/placeholder-product.svg'; }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-charcoal-300" />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="absolute inset-0 bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button type="button" onClick={() => setMain(idx)} title="Imagen principal"
                  className={`p-1.5 rounded-lg transition-colors ${img.isMain ? 'bg-primary-500 text-white' : 'bg-white/90 text-charcoal-600 hover:bg-primary-50 hover:text-primary-500'}`}>
                  <Star className="w-3.5 h-3.5" fill={img.isMain ? 'currentColor' : 'none'} />
                </button>
                <button type="button" onClick={() => remove(idx)} title="Eliminar"
                  className="p-1.5 rounded-lg bg-white/90 text-red-500 hover:bg-red-50">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {img.isMain && (
                <span className="absolute top-1 left-1 bg-primary-500 text-white text-[9px] font-bold font-sans px-1.5 py-0.5 rounded-full">
                  Principal
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {images.length > 0 && (
        <p className="font-sans text-xs text-charcoal-400">
          ★ = imagen principal · Haz clic en la estrella para cambiarla
        </p>
      )}
    </div>
  );
}
