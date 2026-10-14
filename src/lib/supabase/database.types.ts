export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      card_restrictions: {
        Row: {
          canonical_card_id: string;
          effective_from: string;
          effective_until: string | null;
          format: string;
          id: string;
          maximum_quantity: number;
          restriction_type: Database["public"]["Enums"]["restriction_type"];
          source_url: string;
          verified_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          canonical_card_id: string;
          effective_from: string;
          effective_until?: string | null;
          format: string;
          id?: string;
          maximum_quantity: number;
          restriction_type: Database["public"]["Enums"]["restriction_type"];
          source_url: string;
          verified_at?: string | null;
        };
        Update: {
          canonical_card_id?: string;
          effective_from?: string;
          effective_until?: string | null;
          format?: string;
          id?: string;
          maximum_quantity?: number;
          restriction_type?: Database["public"]["Enums"]["restriction_type"];
          source_url?: string;
          verified_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "card_restrictions_canonical_card_id_fkey";
            columns: ["canonical_card_id"];
            isOneToOne: false;
            referencedRelation: "cards";
            referencedColumns: ["id"];
          },
        ];
      };
      cards: {
        Row: {
          attribute: string | null;
          canonical_card_id: string;
          card_number: string;
          card_type: Database["public"]["Enums"]["card_type"];
          colors: Database["public"]["Enums"]["card_color"][];
          cost: number | null;
          counter: number | null;
          created_at: string;
          effect_text: string | null;
          id: string;
          image_url: string | null;
          language: string;
          life: number | null;
          name: string;
          power: number | null;
          printing_code: string;
          rarity: string | null;
          set_code: string | null;
          source: string;
          source_updated_at: string | null;
          traits: string[];
          updated_at: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          attribute?: string | null;
          canonical_card_id: string;
          card_number: string;
          card_type: Database["public"]["Enums"]["card_type"];
          colors?: Database["public"]["Enums"]["card_color"][];
          cost?: number | null;
          counter?: number | null;
          created_at?: string;
          effect_text?: string | null;
          id?: string;
          image_url?: string | null;
          language?: string;
          life?: number | null;
          name: string;
          power?: number | null;
          printing_code?: string;
          rarity?: string | null;
          set_code?: string | null;
          source: string;
          source_updated_at?: string | null;
          traits?: string[];
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          attribute?: string | null;
          canonical_card_id?: string;
          card_number?: string;
          card_type?: Database["public"]["Enums"]["card_type"];
          colors?: Database["public"]["Enums"]["card_color"][];
          cost?: number | null;
          counter?: number | null;
          created_at?: string;
          effect_text?: string | null;
          id?: string;
          image_url?: string | null;
          language?: string;
          life?: number | null;
          name?: string;
          power?: number | null;
          printing_code?: string;
          rarity?: string | null;
          set_code?: string | null;
          source?: string;
          source_updated_at?: string | null;
          traits?: string[];
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cards_canonical_card_id_fkey";
            columns: ["canonical_card_id"];
            isOneToOne: false;
            referencedRelation: "cards";
            referencedColumns: ["id"];
          },
        ];
      };
      collection_allocations: {
        Row: {
          collection_item_id: string;
          deck_id: string;
          id: string;
          quantity: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          collection_item_id: string;
          deck_id: string;
          id?: string;
          quantity: number;
          user_id?: string;
        };
        Update: {
          collection_item_id?: string;
          deck_id?: string;
          id?: string;
          quantity?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "collection_allocations_collection_item_id_user_id_fkey";
            columns: ["collection_item_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "collection_items";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "collection_allocations_deck_id_user_id_fkey";
            columns: ["deck_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "decks";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      collection_items: {
        Row: {
          card_id: string;
          created_at: string;
          finish: string;
          id: string;
          language: string;
          quantity_owned: number;
          quantity_tradeable: number;
          storage_location: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          card_id: string;
          created_at?: string;
          finish?: string;
          id?: string;
          language?: string;
          quantity_owned?: number;
          quantity_tradeable?: number;
          storage_location?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          card_id?: string;
          created_at?: string;
          finish?: string;
          id?: string;
          language?: string;
          quantity_owned?: number;
          quantity_tradeable?: number;
          storage_location?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "collection_items_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "cards";
            referencedColumns: ["id"];
          },
        ];
      };
      deck_cards: {
        Row: {
          card_id: string;
          deck_version_id: string;
          quantity: number;
          role: Database["public"]["Enums"]["card_role"];
        };
        ComputedFields: never;
        Insert: {
          card_id: string;
          deck_version_id: string;
          quantity: number;
          role?: Database["public"]["Enums"]["card_role"];
        };
        Update: {
          card_id?: string;
          deck_version_id?: string;
          quantity?: number;
          role?: Database["public"]["Enums"]["card_role"];
        };
        Relationships: [
          {
            foreignKeyName: "deck_cards_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deck_cards_deck_version_id_fkey";
            columns: ["deck_version_id"];
            isOneToOne: false;
            referencedRelation: "deck_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      deck_versions: {
        Row: {
          change_summary: NonNullable<Json>;
          created_at: string;
          deck_id: string;
          format: string;
          id: string;
          leader_card_id: string;
          notes: string;
          user_id: string;
          version_number: number;
        };
        ComputedFields: never;
        Insert: {
          change_summary?: NonNullable<Json>;
          created_at?: string;
          deck_id: string;
          format: string;
          id?: string;
          leader_card_id: string;
          notes?: string;
          user_id: string;
          version_number: number;
        };
        Update: {
          change_summary?: NonNullable<Json>;
          created_at?: string;
          deck_id?: string;
          format?: string;
          id?: string;
          leader_card_id?: string;
          notes?: string;
          user_id?: string;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "deck_versions_deck_id_user_id_fkey";
            columns: ["deck_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "decks";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "deck_versions_leader_card_id_fkey";
            columns: ["leader_card_id"];
            isOneToOne: false;
            referencedRelation: "cards";
            referencedColumns: ["id"];
          },
        ];
      };
      decks: {
        Row: {
          created_at: string;
          current_version_id: string | null;
          description: string;
          format: string;
          id: string;
          leader_card_id: string;
          name: string;
          status: Database["public"]["Enums"]["deck_status"];
          tags: string[];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          current_version_id?: string | null;
          description?: string;
          format?: string;
          id?: string;
          leader_card_id: string;
          name: string;
          status?: Database["public"]["Enums"]["deck_status"];
          tags?: string[];
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          current_version_id?: string | null;
          description?: string;
          format?: string;
          id?: string;
          leader_card_id?: string;
          name?: string;
          status?: Database["public"]["Enums"]["deck_status"];
          tags?: string[];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "decks_current_version_fk";
            columns: ["current_version_id", "id"];
            isOneToOne: false;
            referencedRelation: "deck_versions";
            referencedColumns: ["id", "deck_id"];
          },
          {
            foreignKeyName: "decks_leader_card_id_fkey";
            columns: ["leader_card_id"];
            isOneToOne: false;
            referencedRelation: "cards";
            referencedColumns: ["id"];
          },
        ];
      };
      import_jobs: {
        Row: {
          created_at: string;
          error_report: NonNullable<Json>;
          id: string;
          raw_input: string;
          source: string;
          status: Database["public"]["Enums"]["import_status"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          error_report?: NonNullable<Json>;
          id?: string;
          raw_input: string;
          source: string;
          status?: Database["public"]["Enums"]["import_status"];
          user_id?: string;
        };
        Update: {
          created_at?: string;
          error_report?: NonNullable<Json>;
          id?: string;
          raw_input?: string;
          source?: string;
          status?: Database["public"]["Enums"]["import_status"];
          user_id?: string;
        };
        Relationships: [];
      };
      matches: {
        Row: {
          created_at: string;
          deck_version_id: string;
          format: string;
          id: string;
          match_type: string;
          notes: string;
          opponent_leader_id: string;
          opponent_name: string | null;
          played_at: string;
          result: Database["public"]["Enums"]["match_result"];
          tournament_id: string | null;
          updated_at: string;
          user_id: string;
          went_first: boolean;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          deck_version_id: string;
          format?: string;
          id?: string;
          match_type?: string;
          notes?: string;
          opponent_leader_id: string;
          opponent_name?: string | null;
          played_at?: string;
          result: Database["public"]["Enums"]["match_result"];
          tournament_id?: string | null;
          updated_at?: string;
          user_id?: string;
          went_first: boolean;
        };
        Update: {
          created_at?: string;
          deck_version_id?: string;
          format?: string;
          id?: string;
          match_type?: string;
          notes?: string;
          opponent_leader_id?: string;
          opponent_name?: string | null;
          played_at?: string;
          result?: Database["public"]["Enums"]["match_result"];
          tournament_id?: string | null;
          updated_at?: string;
          user_id?: string;
          went_first?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "matches_deck_version_id_user_id_fkey";
            columns: ["deck_version_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "deck_versions";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "matches_opponent_leader_id_fkey";
            columns: ["opponent_leader_id"];
            isOneToOne: false;
            referencedRelation: "cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_tournament_id_user_id_fkey";
            columns: ["tournament_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "tournaments";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      tournament_rounds: {
        Row: {
          id: string;
          match_id: string;
          notes: string;
          opponent_name: string | null;
          result: Database["public"]["Enums"]["match_result"];
          round_number: number;
          tournament_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          match_id: string;
          notes?: string;
          opponent_name?: string | null;
          result: Database["public"]["Enums"]["match_result"];
          round_number: number;
          tournament_id: string;
          user_id?: string;
        };
        Update: {
          id?: string;
          match_id?: string;
          notes?: string;
          opponent_name?: string | null;
          result?: Database["public"]["Enums"]["match_result"];
          round_number?: number;
          tournament_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tournament_rounds_match_id_tournament_id_user_id_fkey";
            columns: ["match_id", "tournament_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id", "tournament_id", "user_id"];
          },
          {
            foreignKeyName: "tournament_rounds_tournament_id_user_id_fkey";
            columns: ["tournament_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "tournaments";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      tournaments: {
        Row: {
          archived_at: string | null;
          created_at: string;
          deck_version_id: string | null;
          event_date: string;
          format: string;
          id: string;
          location: string | null;
          name: string;
          notes: string;
          placement: number | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          deck_version_id?: string | null;
          event_date: string;
          format?: string;
          id?: string;
          location?: string | null;
          name: string;
          notes?: string;
          placement?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          deck_version_id?: string | null;
          event_date?: string;
          format?: string;
          id?: string;
          location?: string | null;
          name?: string;
          notes?: string;
          placement?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tournaments_deck_version_id_user_id_fkey";
            columns: ["deck_version_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "deck_versions";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      save_deck: { Args: { p_input: Json }; Returns: string };
      save_deck_version: {
        Args: {
          p_cards: Json;
          p_deck_id: string;
          p_leader_card_id: string;
          p_notes?: string;
        };
        Returns: string;
      };
      save_match: { Args: { p_input: Json }; Returns: string };
    };
    Enums: {
      card_color: "red" | "green" | "blue" | "purple" | "black" | "yellow";
      card_role: "main" | "don";
      card_type: "leader" | "character" | "event" | "stage" | "don";
      deck_status: "draft" | "active" | "archived";
      import_status: "pending" | "preview" | "confirmed" | "failed";
      match_result: "win" | "loss" | "draw";
      restriction_type: "banned" | "restricted" | "limited";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      card_color: ["red", "green", "blue", "purple", "black", "yellow"],
      card_role: ["main", "don"],
      card_type: ["leader", "character", "event", "stage", "don"],
      deck_status: ["draft", "active", "archived"],
      import_status: ["pending", "preview", "confirmed", "failed"],
      match_result: ["win", "loss", "draw"],
      restriction_type: ["banned", "restricted", "limited"],
    },
  },
} as const;
