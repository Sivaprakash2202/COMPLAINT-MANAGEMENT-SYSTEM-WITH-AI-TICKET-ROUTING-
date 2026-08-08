import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, X, FileIcon, Image, FileText, Loader2, Wand2, Sparkles } from "lucide-react";

interface FileUploadProps {
  complaintId?: string;
  onFilesChange: (files: UploadedFile[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
}

export interface UploadedFile {
  name: string;
  path: string;
  size: number;
  type: string;
}

const FileUpload = ({ complaintId, onFilesChange, maxFiles = 5, maxSizeMB = 10 }: FileUploadProps) => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const enhanceImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(file);

        canvas.width = img.width;
        canvas.height = img.height;
        
        // Simple Enhancement: Boost contrast and brightness
        ctx.filter = "brightness(1.1) contrast(1.1) saturate(1.1)";
        ctx.drawImage(img, 0, 0);

        canvas.toBlob((blob) => {
          if (!blob) return resolve(file);
          const enhancedFile = new File([blob], file.name, { type: file.type });
          resolve(enhancedFile);
        }, file.type);
      };
      img.onerror = () => resolve(file);
    });
  };

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    if (files.length + selectedFiles.length > maxFiles) {
      toast({
        title: "Too many files",
        description: `Maximum ${maxFiles} files allowed`,
        variant: "destructive",
      });
      return;
    }

    const validFiles = selectedFiles.filter(file => {
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not a supported file type`,
          variant: "destructive",
        });
        return false;
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds ${maxSizeMB}MB limit`,
          variant: "destructive",
        });
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setUploading(true);

    try {
      const uploadedFiles: UploadedFile[] = [];

      for (let file of validFiles) {
        // Auto-enhance if it's an image
        if (file.type.startsWith("image/")) {
           setEnhancing(true);
           file = await enhanceImage(file);
           setEnhancing(false);
        }

        const fileExt = file.name.split(".").pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = complaintId 
          ? `${complaintId}/${fileName}`
          : `temp/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("complaint-attachments")
          .upload(filePath, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          toast({
            title: "Upload failed",
            description: `Failed to upload ${file.name}`,
            variant: "destructive",
          });
          continue;
        }

        uploadedFiles.push({
          name: file.name,
          path: filePath,
          size: file.size,
          type: file.type,
        });
      }

      const newFiles = [...files, ...uploadedFiles];
      setFiles(newFiles);
      onFilesChange(newFiles);

      if (uploadedFiles.length > 0) {
        toast({
          title: "Files uploaded",
          description: `${uploadedFiles.length} file(s) uploaded successfully`,
        });
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "An error occurred while uploading files",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeFile = async (index: number) => {
    const fileToRemove = files[index];
    
    try {
      await supabase.storage
        .from("complaint-attachments")
        .remove([fileToRemove.path]);
    } catch (error) {
      console.error("Failed to remove file from storage:", error);
    }

    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    onFilesChange(newFiles);
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) {
      return <Image className="h-4 w-4 text-primary" />;
    }
    if (type.includes("pdf")) {
      return <FileText className="h-4 w-4 text-destructive" />;
    }
    return <FileIcon className="h-4 w-4 text-muted-foreground" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">
          Attachments (optional)
        </label>
        <span className="text-xs text-muted-foreground">
          {files.length}/{maxFiles} files
        </span>
      </div>

      {/* Upload Zone */}
      <div 
        className="relative border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={allowedTypes.join(",")}
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading || files.length >= maxFiles}
        />
        
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">
              {enhancing ? "Auto-Enhancing Image..." : "Uploading..."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <Wand2 className="h-4 w-4 text-primary absolute -right-2 -top-1 animate-bounce" />
            </div>
            <p className="text-sm text-muted-foreground">
              Click or drag files to upload
            </p>
            <p className="text-xs text-primary font-medium flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Smart Auto-Enhance Enabled
            </p>
          </div>
        )}
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={file.path}
              className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                {getFileIcon(file.type)}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(index);
                }}
                className="shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUpload;
