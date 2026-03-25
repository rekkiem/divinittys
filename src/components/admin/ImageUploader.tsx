'use client';
/**
 * ImageUploader — drag-and-drop image upload for product forms.
 * Uses /api/admin/upload endpoint. Works with MinIO or local storage.
 */
import { useCallback, useState } from 'react';
import Image from 'next/image';
import { Upload, X, Star, Loader2, ImageIcon } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import toast from 'react-hot-toast';

type UploadedImage = { url: string; isMain: boolean; id?: string };

type ImageUploaderProps = {
  productId?: string;
  initialImages?: UploadedImage[];
  onImagesChange?: (images: UploadedImage[]) => void;
  maxImages?: number;
};

export default function ImageUploader({
  productId, initialImages = [], onImagesChange, maxImages = 8,
}: ImageUploaderProps) {
  const [images, setImages] = useState<UploadedImage[]>(initialImages);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { accessToken } = useAuthStore();

  const updateImages = (next: UploadedImage[]) => {
    setImages(next);
    onImagesChange?.(next);
  };

  const uploadFile = async (file: File, isMain = false) => {
    const fd = new FormData();
    fd.append('file', file);
    if (productId) fd.append('productId', productId);
    fd.append('isMain', String(isMain));

    const headers: Record<string, string> = {};
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

    const res  = await fetch('/api/admin/upload', { method: 'POST', headers, credentials: 'include', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data.url as string;
  };

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    if (images.length + files.length > maxImages) {
      toast.error(`Máximo ${maxImages} imágenes`);
      return;
    }
    setUploading(true);
    try {
      const newImgs: UploadedImage[] = [];
      for (const file of Array.from(files)) {
        const isMain = images.length === 0 && newImgs.length === 0;
        const url = await uploadFile(file, isMain);
        newImgs.push({ url, isMain });
      }
      updateImages([...images, ...newImgs]);
      toast.success(`${newImgs.length} imagen(es) subida(s)`);
    } catch (e: any) {
      toast.error(e.message || 'Error al subir imagen');
    } finally {
      setUploading(false);
    }
  }, [images, productId, accessToken]);

  const setMain = (idx: number) => {
    updateImages(images.map((img, i) => ({ ...img, isMain: i === idx })));
  };

  const remove = (idx: number) => {
    updateImages(images.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <label
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-8 cursor-pointer transition-colors ${
          dragging ? 'border-primary-400 bg-primary-50' : 'border-champagne-300 hover:border-primary-300 hover:bg-champagne-50'
        }`}
      >
        <input type="file" accept="image/*" multiple className="hidden"
          onChange={e => handleFiles(e.target.files)} disabled={uploading} />
        {uploading ? (
          <Loader2 className="w-8 h-8 text-primary-400 animate-spin mb-2" />
        ) : (
          <Upload className="w-8 h-8 text-primary-400 mb-2" />
        )}
        <p className="font-sans text-sm text-charcoal-500">
          {uploading ? 'Subiendo...' : 'Arrastra imágenes aquí o haz clic para seleccionar'}
        </p>
        <p className="font-sans text-xs text-charcoal-400 mt-1">JPEG, PNG, WebP — máx. 5MB por imagen</p>
      </label>

      {/* Preview grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {images.map((img, idx) => (
            <div key={idx} className="relative group aspect-square">
              <div className="w-full h-full rounded-xl overflow-hidden border-2 border-champagne-200 bg-champagne-50">
                {img.url ? (
                  <Image src={img.url} alt={`Imagen ${idx + 1}`} fill className="object-cover" sizes="120px"
                    onError={e => { (e.target as HTMLImageElement).src = '/placeholder-product.svg'; }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-charcoal-200" />
                  </div>
                )}
              </div>
              {/* Actions overlay */}
              <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button type="button" onClick={() => setMain(idx)}
                  className={`p-1.5 rounded-lg transition-colors ${img.isMain ? 'bg-primary-500 text-white' : 'bg-white/80 text-charcoal-600 hover:bg-primary-50'}`}
                  title="Imagen principal">
                  <Star className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => remove(idx)}
                  className="p-1.5 rounded-lg bg-white/80 text-red-500 hover:bg-red-50 transition-colors"
                  title="Eliminar">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {img.isMain && (
                <span className="absolute top-1 left-1 bg-primary-500 text-white text-[10px] font-sans font-bold px-1.5 py-0.5 rounded-full">
                  Principal
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
