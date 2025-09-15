export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      karaoke_tracks: {
        Row: {
          created_at: string
          file_type: string
          id: string
          karaoke_file_url: string
          original_singer_name: string
          original_song_url: string | null
          song_title: string
          updated_at: string
          uploader_id: string
        }
        Insert: {
          created_at?: string
          file_type: string
          id?: string
          karaoke_file_url: string
          original_singer_name: string
          original_song_url?: string | null
          song_title: string
          updated_at?: string
          uploader_id: string
        }
        Update: {
          created_at?: string
          file_type?: string
          id?: string
          karaoke_file_url?: string
          original_singer_name?: string
          original_song_url?: string | null
          song_title?: string
          updated_at?: string
          uploader_id?: string
        }
        Relationships: []
      }
      performances: {
        Row: {
          analysis_data: Json | null
          audio_url: string | null
          created_at: string | null
          id: string
          similarity_score: number | null
          singer_id: string
          song_id: string
          title: string
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          analysis_data?: Json | null
          audio_url?: string | null
          created_at?: string | null
          id?: string
          similarity_score?: number | null
          singer_id: string
          song_id: string
          title: string
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          analysis_data?: Json | null
          audio_url?: string | null
          created_at?: string | null
          id?: string
          similarity_score?: number | null
          singer_id?: string
          song_id?: string
          title?: string
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "performances_singer_id_fkey"
            columns: ["singer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performances_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          age: number | null
          contact_number: string | null
          created_at: string | null
          email: string
          full_name: string
          gender: string | null
          id: string
          profile_photo_url: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          age?: number | null
          contact_number?: string | null
          created_at?: string | null
          email: string
          full_name: string
          gender?: string | null
          id: string
          profile_photo_url?: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          age?: number | null
          contact_number?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          gender?: string | null
          id?: string
          profile_photo_url?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      songs: {
        Row: {
          artist: string
          created_at: string | null
          id: string
          karaoke_url: string | null
          lyrics: string | null
          professional_audio_url: string | null
          title: string
        }
        Insert: {
          artist: string
          created_at?: string | null
          id?: string
          karaoke_url?: string | null
          lyrics?: string | null
          professional_audio_url?: string | null
          title: string
        }
        Update: {
          artist?: string
          created_at?: string | null
          id?: string
          karaoke_url?: string | null
          lyrics?: string | null
          professional_audio_url?: string | null
          title?: string
        }
        Relationships: []
      }
      uploaded_songs: {
        Row: {
          created_at: string
          id: string
          original_file_type: string | null
          original_singer_name: string
          original_song_url: string | null
          recorded_file_type: string | null
          recorded_song_url: string | null
          singer_id: string
          song_title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          original_file_type?: string | null
          original_singer_name: string
          original_song_url?: string | null
          recorded_file_type?: string | null
          recorded_song_url?: string | null
          singer_id: string
          song_title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          original_file_type?: string | null
          original_singer_name?: string
          original_song_url?: string | null
          recorded_file_type?: string | null
          recorded_song_url?: string | null
          singer_id?: string
          song_title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "uploaded_songs_singer_id_profiles_fkey"
            columns: ["singer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
      votes: {
        Row: {
          comments: string | null
          created_at: string | null
          id: string
          overall_score: number | null
          performance_id: string
          score: number
          voice_score: number | null
          voter_id: string
        }
        Insert: {
          comments?: string | null
          created_at?: string | null
          id?: string
          overall_score?: number | null
          performance_id: string
          score: number
          voice_score?: number | null
          voter_id: string
        }
        Update: {
          comments?: string | null
          created_at?: string | null
          id?: string
          overall_score?: number | null
          performance_id?: string
          score?: number
          voice_score?: number | null
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_performance_id_fkey"
            columns: ["performance_id"]
            isOneToOne: false
            referencedRelation: "uploaded_songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_public_profile: {
        Args: { profile_id: string }
        Returns: {
          full_name: string
          id: string
          profile_photo_url: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      user_role: "singer" | "judge" | "audience"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      user_role: ["singer", "judge", "audience"],
    },
  },
} as const
