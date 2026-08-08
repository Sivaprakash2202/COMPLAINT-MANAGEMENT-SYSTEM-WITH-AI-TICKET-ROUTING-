export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      [key: string]: {
        Row: Record<string, any>
        Insert: Record<string, any>
        Update: Record<string, any>
        Relationships: any[]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [key: string]: any
    }
    Enums: {
      department_type: "academic" | "infrastructure" | "administration" | "library" | "sports"
      complaint_status: "pending" | "in_progress" | "resolved" | "rejected"
      [key: string]: any
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
