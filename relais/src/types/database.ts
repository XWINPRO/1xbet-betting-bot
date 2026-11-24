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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: number
          metadata: Json
          store_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: never
          metadata?: Json
          store_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: never
          metadata?: Json
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          job_id: string | null
          order_id: string | null
          reference: string
          reporter_name: string | null
          reporter_phone: string | null
          reporter_type: string
          reporter_user_id: string | null
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["claim_status"]
          store_id: string | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          id?: string
          job_id?: string | null
          order_id?: string | null
          reference?: string
          reporter_name?: string | null
          reporter_phone?: string | null
          reporter_type: string
          reporter_user_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          job_id?: string | null
          order_id?: string | null
          reference?: string
          reporter_name?: string | null
          reporter_phone?: string | null
          reporter_type?: string
          reporter_user_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "claims_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "delivery_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_reporter_user_id_fkey"
            columns: ["reporter_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_locations: {
        Row: {
          accuracy: number | null
          courier_id: string
          heading: number | null
          id: number
          job_id: string | null
          lat: number
          lng: number
          received_at: string
          recorded_at: string
          speed: number | null
        }
        Insert: {
          accuracy?: number | null
          courier_id: string
          heading?: number | null
          id?: never
          job_id?: string | null
          lat: number
          lng: number
          received_at?: string
          recorded_at: string
          speed?: number | null
        }
        Update: {
          accuracy?: number | null
          courier_id?: string
          heading?: number | null
          id?: never
          job_id?: string | null
          lat?: number
          lng?: number
          received_at?: string
          recorded_at?: string
          speed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "courier_locations_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_locations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "delivery_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_store_memberships: {
        Row: {
          courier_id: string
          created_at: string
          status: Database["public"]["Enums"]["membership_status"]
          store_id: string
        }
        Insert: {
          courier_id: string
          created_at?: string
          status?: Database["public"]["Enums"]["membership_status"]
          store_id: string
        }
        Update: {
          courier_id?: string
          created_at?: string
          status?: Database["public"]["Enums"]["membership_status"]
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_store_memberships_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_store_memberships_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      couriers: {
        Row: {
          account_status: Database["public"]["Enums"]["courier_account_status"]
          availability: Database["public"]["Enums"]["courier_availability"]
          availability_changed_at: string | null
          created_at: string
          created_by: string | null
          full_name: string
          id: string
          id_document_path: string | null
          kind: Database["public"]["Enums"]["courier_kind"]
          last_accuracy: number | null
          last_heading: number | null
          last_lat: number | null
          last_lng: number | null
          last_location_at: string | null
          last_seen_at: string | null
          last_speed: number | null
          notes: string | null
          phone: string
          review_note: string | null
          updated_at: string
          user_id: string | null
          vehicle_plate: string | null
          vehicle_type: string | null
          zone: string | null
          zone_lat: number | null
          zone_lng: number | null
          zone_radius_km: number | null
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["courier_account_status"]
          availability?: Database["public"]["Enums"]["courier_availability"]
          availability_changed_at?: string | null
          created_at?: string
          created_by?: string | null
          full_name: string
          id?: string
          id_document_path?: string | null
          kind: Database["public"]["Enums"]["courier_kind"]
          last_accuracy?: number | null
          last_heading?: number | null
          last_lat?: number | null
          last_lng?: number | null
          last_location_at?: string | null
          last_seen_at?: string | null
          last_speed?: number | null
          notes?: string | null
          phone: string
          review_note?: string | null
          updated_at?: string
          user_id?: string | null
          vehicle_plate?: string | null
          vehicle_type?: string | null
          zone?: string | null
          zone_lat?: number | null
          zone_lng?: number | null
          zone_radius_km?: number | null
        }
        Update: {
          account_status?: Database["public"]["Enums"]["courier_account_status"]
          availability?: Database["public"]["Enums"]["courier_availability"]
          availability_changed_at?: string | null
          created_at?: string
          created_by?: string | null
          full_name?: string
          id?: string
          id_document_path?: string | null
          kind?: Database["public"]["Enums"]["courier_kind"]
          last_accuracy?: number | null
          last_heading?: number | null
          last_lat?: number | null
          last_lng?: number | null
          last_location_at?: string | null
          last_seen_at?: string | null
          last_speed?: number | null
          notes?: string | null
          phone?: string
          review_note?: string | null
          updated_at?: string
          user_id?: string | null
          vehicle_plate?: string | null
          vehicle_type?: string | null
          zone?: string | null
          zone_lat?: number | null
          zone_lng?: number | null
          zone_radius_km?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "couriers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couriers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          lat: number | null
          lng: number | null
          notes: string | null
          phone: string
          store_id: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          phone: string
          store_id: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          phone?: string
          store_id?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_assignments: {
        Row: {
          courier_id: string
          id: string
          job_id: string
          note: string | null
          offered_at: string
          offered_by: string | null
          responded_at: string | null
          status: Database["public"]["Enums"]["assignment_status"]
        }
        Insert: {
          courier_id: string
          id?: string
          job_id: string
          note?: string | null
          offered_at?: string
          offered_by?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
        }
        Update: {
          courier_id?: string
          id?: string
          job_id?: string
          note?: string | null
          offered_at?: string
          offered_by?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "delivery_assignments_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_assignments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "delivery_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_assignments_offered_by_fkey"
            columns: ["offered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_events: {
        Row: {
          actor_id: string | null
          created_at: string
          id: number
          job_id: string
          lat: number | null
          lng: number | null
          message: string | null
          status: Database["public"]["Enums"]["job_status"] | null
          type: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: never
          job_id: string
          lat?: number | null
          lng?: number | null
          message?: string | null
          status?: Database["public"]["Enums"]["job_status"] | null
          type: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: never
          job_id?: string
          lat?: number | null
          lng?: number | null
          message?: string | null
          status?: Database["public"]["Enums"]["job_status"] | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "delivery_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_jobs: {
        Row: {
          accepted_at: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cash_collected: boolean
          collect_amount: number
          courier_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          delivered_at: string | null
          distance_km: number | null
          dropoff_address: string
          dropoff_lat: number | null
          dropoff_lng: number | null
          dropoff_name: string
          dropoff_phone: string
          failed_at: string | null
          failure_reason: string | null
          id: string
          in_transit_at: string | null
          instructions: string | null
          offered_at: string | null
          order_id: string | null
          package_description: string | null
          package_type: string | null
          payer: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          picked_up_at: string | null
          pickup_address: string
          pickup_lat: number | null
          pickup_lng: number | null
          pickup_name: string | null
          pickup_phone: string | null
          price: number
          proof_note: string | null
          proof_photo_path: string | null
          proof_recipient_name: string | null
          recipient_confirmed_at: string | null
          reference: string
          requester_name: string | null
          requester_phone: string | null
          requester_user_id: string | null
          share_courier_phone: boolean
          source: Database["public"]["Enums"]["job_source"]
          status: Database["public"]["Enums"]["job_status"]
          store_id: string | null
          tracking_active: boolean
          tracking_token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cash_collected?: boolean
          collect_amount?: number
          courier_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          delivered_at?: string | null
          distance_km?: number | null
          dropoff_address: string
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropoff_name: string
          dropoff_phone: string
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          in_transit_at?: string | null
          instructions?: string | null
          offered_at?: string | null
          order_id?: string | null
          package_description?: string | null
          package_type?: string | null
          payer?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          picked_up_at?: string | null
          pickup_address: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_name?: string | null
          pickup_phone?: string | null
          price?: number
          proof_note?: string | null
          proof_photo_path?: string | null
          proof_recipient_name?: string | null
          recipient_confirmed_at?: string | null
          reference?: string
          requester_name?: string | null
          requester_phone?: string | null
          requester_user_id?: string | null
          share_courier_phone?: boolean
          source: Database["public"]["Enums"]["job_source"]
          status?: Database["public"]["Enums"]["job_status"]
          store_id?: string | null
          tracking_active?: boolean
          tracking_token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cash_collected?: boolean
          collect_amount?: number
          courier_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          delivered_at?: string | null
          distance_km?: number | null
          dropoff_address?: string
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropoff_name?: string
          dropoff_phone?: string
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          in_transit_at?: string | null
          instructions?: string | null
          offered_at?: string | null
          order_id?: string | null
          package_description?: string | null
          package_type?: string | null
          payer?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          picked_up_at?: string | null
          pickup_address?: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_name?: string | null
          pickup_phone?: string | null
          price?: number
          proof_note?: string | null
          proof_photo_path?: string | null
          proof_recipient_name?: string | null
          recipient_confirmed_at?: string | null
          reference?: string
          requester_name?: string | null
          requester_phone?: string | null
          requester_user_id?: string | null
          share_courier_phone?: boolean
          source?: Database["public"]["Enums"]["job_source"]
          status?: Database["public"]["Enums"]["job_status"]
          store_id?: string | null
          tracking_active?: boolean
          tracking_token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_jobs_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_jobs_requester_user_id_fkey"
            columns: ["requester_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_jobs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          courier_id: string | null
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          kind: Database["public"]["Enums"]["invitation_kind"]
          label: string | null
          permissions: string[]
          revoked_at: string | null
          store_id: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          courier_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          kind: Database["public"]["Enums"]["invitation_kind"]
          label?: string | null
          permissions?: string[]
          revoked_at?: string | null
          store_id: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          courier_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["invitation_kind"]
          label?: string | null
          permissions?: string[]
          revoked_at?: string | null
          store_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          actor_id: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: number
          message: string | null
          order_id: string
          store_id: string
          to_status: Database["public"]["Enums"]["order_status"] | null
          type: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: never
          message?: string | null
          order_id: string
          store_id: string
          to_status?: Database["public"]["Enums"]["order_status"] | null
          type: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: never
          message?: string | null
          order_id?: string
          store_id?: string
          to_status?: Database["public"]["Enums"]["order_status"] | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number | null
          name: string
          order_id: string
          product_id: string | null
          quantity: number
          unit_price: number
          variant_id: string | null
          variant_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          line_total?: number | null
          name: string
          order_id: string
          product_id?: string | null
          quantity: number
          unit_price: number
          variant_id?: string | null
          variant_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number | null
          name?: string
          order_id?: string
          product_id?: string | null
          quantity?: number
          unit_price?: number
          variant_id?: string | null
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          current_job_id: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string
          delivered_at: string | null
          delivery_address: string | null
          delivery_fee: number
          delivery_lat: number | null
          delivery_lng: number | null
          delivery_mode: string
          discount: number
          id: string
          instructions: string | null
          internal_note: string | null
          number: number
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          reference: string
          source: Database["public"]["Enums"]["order_source"]
          status: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          current_job_id?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_fee?: number
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_mode?: string
          discount?: number
          id?: string
          instructions?: string | null
          internal_note?: string | null
          number: number
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          reference: string
          source?: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          current_job_id?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_fee?: number
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_mode?: string
          discount?: number
          id?: string
          instructions?: string | null
          internal_note?: string | null
          number?: number
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          reference?: string
          source?: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_current_job_fk"
            columns: ["current_job_id"]
            isOneToOne: false
            referencedRelation: "delivery_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          base_fee: number
          created_at: string
          currency: string
          id: string
          is_active: boolean
          max_distance_km: number | null
          min_fee: number
          name: string
          package_surcharges: Json
          per_km_fee: number
          rounding: number
          updated_at: string
        }
        Insert: {
          base_fee?: number
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          max_distance_km?: number | null
          min_fee?: number
          name: string
          package_surcharges?: Json
          per_km_fee?: number
          rounding?: number
          updated_at?: string
        }
        Update: {
          base_fee?: number
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          max_distance_km?: number | null
          min_fee?: number
          name?: string
          package_surcharges?: Json
          per_km_fee?: number
          rounding?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          images: string[]
          name: string
          price: number
          promo_price: number | null
          sku: string | null
          status: Database["public"]["Enums"]["product_status"]
          stock: number | null
          store_id: string
          track_stock: boolean
          updated_at: string
          variants: Json
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          images?: string[]
          name: string
          price: number
          promo_price?: number | null
          sku?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number | null
          store_id: string
          track_stock?: boolean
          updated_at?: string
          variants?: Json
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          images?: string[]
          name?: string
          price?: number
          promo_price?: number | null
          sku?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number | null
          store_id?: string
          track_stock?: boolean
          updated_at?: string
          variants?: Json
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_platform_admin: boolean
          is_suspended: boolean
          phone: string | null
          suspended_reason: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          is_platform_admin?: boolean
          is_suspended?: boolean
          phone?: string | null
          suspended_reason?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_platform_admin?: boolean
          is_suspended?: boolean
          phone?: string | null
          suspended_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      store_members: {
        Row: {
          created_at: string
          permissions: string[]
          role: Database["public"]["Enums"]["store_role"]
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          permissions?: string[]
          role?: Database["public"]["Enums"]["store_role"]
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          permissions?: string[]
          role?: Database["public"]["Enums"]["store_role"]
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_members_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          accepted_payment_methods: Database["public"]["Enums"]["payment_method"][]
          address: string | null
          banner_path: string | null
          category: string | null
          city: string | null
          courier_max_active_jobs: number
          created_at: string
          currency: string
          default_delivery_fee: number
          delivery_terms: string | null
          description: string | null
          email: string | null
          id: string
          is_published: boolean
          lat: number | null
          lng: number | null
          logo_path: string | null
          name: string
          opening_hours: Json
          order_seq: number
          organization_id: string
          phone: string | null
          share_courier_phone: boolean
          slug: string
          status: Database["public"]["Enums"]["store_status"]
          status_reason: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          accepted_payment_methods?: Database["public"]["Enums"]["payment_method"][]
          address?: string | null
          banner_path?: string | null
          category?: string | null
          city?: string | null
          courier_max_active_jobs?: number
          created_at?: string
          currency?: string
          default_delivery_fee?: number
          delivery_terms?: string | null
          description?: string | null
          email?: string | null
          id?: string
          is_published?: boolean
          lat?: number | null
          lng?: number | null
          logo_path?: string | null
          name: string
          opening_hours?: Json
          order_seq?: number
          organization_id: string
          phone?: string | null
          share_courier_phone?: boolean
          slug: string
          status?: Database["public"]["Enums"]["store_status"]
          status_reason?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          accepted_payment_methods?: Database["public"]["Enums"]["payment_method"][]
          address?: string | null
          banner_path?: string | null
          category?: string | null
          city?: string | null
          courier_max_active_jobs?: number
          created_at?: string
          currency?: string
          default_delivery_fee?: number
          delivery_terms?: string | null
          description?: string | null
          email?: string | null
          id?: string
          is_published?: boolean
          lat?: number | null
          lng?: number | null
          logo_path?: string | null
          name?: string
          opening_hours?: Json
          order_seq?: number
          organization_id?: string
          phone?: string | null
          share_courier_phone?: boolean
          slug?: string
          status?: Database["public"]["Enums"]["store_status"]
          status_reason?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          currency: string
          id: string
          job_id: string | null
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          order_id: string | null
          provider: string
          provider_reference: string | null
          recorded_by: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          store_id: string | null
        }
        Insert: {
          amount: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          currency?: string
          id?: string
          job_id?: string | null
          method: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          order_id?: string | null
          provider?: string
          provider_reference?: string | null
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          store_id?: string | null
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          currency?: string
          id?: string
          job_id?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          order_id?: string | null
          provider?: string
          provider_reference?: string | null
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "delivery_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _apply_order_items: {
        Args: {
          p_allow_custom: boolean
          p_items: Json
          p_order: string
          p_store: string
        }
        Returns: undefined
      }
      _hash_token: { Args: { p_token: string }; Returns: string }
      _refresh_payment_status: {
        Args: { p_job: string; p_order: string }
        Returns: undefined
      }
      _restock_order_items: { Args: { p_order: string }; Returns: undefined }
      _upsert_customer: {
        Args: {
          p_address: string
          p_lat: number
          p_lng: number
          p_name: string
          p_phone: string
          p_store: string
        }
        Returns: string
      }
      accept_invitation: { Args: { p_token: string }; Returns: Json }
      add_order_note: {
        Args: { p_note: string; p_order_id: string }
        Returns: undefined
      }
      admin_courier_board: {
        Args: { p_kind?: Database["public"]["Enums"]["courier_kind"] }
        Returns: {
          account_status: Database["public"]["Enums"]["courier_account_status"]
          active_jobs: number
          availability: Database["public"]["Enums"]["courier_availability"]
          courier_id: string
          created_at: string
          delivered_total: number
          effective_status: string
          full_name: string
          kind: Database["public"]["Enums"]["courier_kind"]
          last_lat: number
          last_lng: number
          last_location_at: string
          last_seen_at: string
          phone: string
          stores_count: number
          vehicle_type: string
          zone: string
        }[]
      }
      admin_daily_series: {
        Args: { p_from: string; p_to: string; p_tz?: string }
        Returns: {
          bucket_day: string
          delivered_count: number
          failed_count: number
          on_demand_count: number
          orders_count: number
        }[]
      }
      admin_overview_stats: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      admin_review_courier: {
        Args: { p_courier_id: string; p_decision: string; p_note?: string }
        Returns: undefined
      }
      admin_set_platform_admin: {
        Args: { p_user_id: string; p_value: boolean }
        Returns: undefined
      }
      admin_set_store_status: {
        Args: {
          p_reason?: string
          p_status: Database["public"]["Enums"]["store_status"]
          p_store_id: string
        }
        Returns: undefined
      }
      admin_set_user_suspension: {
        Args: { p_reason?: string; p_suspended: boolean; p_user_id: string }
        Returns: undefined
      }
      admin_update_setting: {
        Args: { p_key: string; p_value: Json }
        Returns: undefined
      }
      apply_platform_courier: { Args: { p_payload: Json }; Returns: string }
      assign_courier: {
        Args: { p_courier_id: string; p_job_id: string }
        Returns: undefined
      }
      broadcast_tracking: { Args: { p_token: string }; Returns: undefined }
      cancel_delivery_job: {
        Args: { p_job_id: string; p_reason: string }
        Returns: undefined
      }
      cancel_on_demand_by_token: { Args: { p_token: string }; Returns: boolean }
      confirm_delivery_receipt: { Args: { p_token: string }; Returns: boolean }
      confirm_transaction: {
        Args: {
          p_status: Database["public"]["Enums"]["transaction_status"]
          p_tx_id: string
        }
        Returns: undefined
      }
      courier_active_jobs: { Args: { p_courier: string }; Returns: number }
      courier_claim_job: { Args: { p_job_id: string }; Returns: undefined }
      courier_effective_status: {
        Args: {
          p_account: Database["public"]["Enums"]["courier_account_status"]
          p_active_jobs: number
          p_availability: Database["public"]["Enums"]["courier_availability"]
          p_last_seen: string
          p_max_jobs: number
        }
        Returns: string
      }
      courier_heartbeat: { Args: never; Returns: Json }
      courier_open_jobs: {
        Args: never
        Returns: {
          created_at: string
          currency: string
          distance_km: number
          distance_to_pickup_km: number
          dropoff_address: string
          dropoff_lat: number
          dropoff_lng: number
          id: string
          package_type: string
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          price: number
          reference: string
        }[]
      }
      courier_report_issue: {
        Args: { p_category: string; p_description: string; p_job_id: string }
        Returns: string
      }
      courier_respond_offer: {
        Args: { p_accept: boolean; p_job_id: string; p_reason?: string }
        Returns: undefined
      }
      courier_set_availability: {
        Args: { p_available: boolean }
        Returns: Json
      }
      courier_settings: { Args: never; Returns: Json }
      courier_update_job: {
        Args: {
          p_job_id: string
          p_payload?: Json
          p_status: Database["public"]["Enums"]["job_status"]
        }
        Returns: undefined
      }
      courier_update_profile: { Args: { p_payload: Json }; Returns: undefined }
      create_delivery_job: {
        Args: { p_options?: Json; p_order_id: string }
        Returns: Json
      }
      create_on_demand_delivery: { Args: { p_payload: Json }; Returns: Json }
      create_order: {
        Args: { p_payload: Json; p_store_id: string }
        Returns: Json
      }
      create_staff_invitation: {
        Args: { p_label?: string; p_permissions: string[]; p_store_id: string }
        Returns: string
      }
      create_store: { Args: { p_payload: Json }; Returns: string }
      get_invitation: { Args: { p_token: string }; Returns: Json }
      get_tracking: { Args: { p_token: string }; Returns: Json }
      has_store_permission: {
        Args: { p_perm: string; p_store: string }
        Returns: boolean
      }
      haversine_km: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      is_active_user: { Args: never; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      is_store_courier: { Args: { p_store: string }; Returns: boolean }
      is_store_courier_of: { Args: { p_courier: string }; Returns: boolean }
      is_store_member: { Args: { p_store: string }; Returns: boolean }
      is_store_owner: { Args: { p_store: string }; Returns: boolean }
      is_valid_phone: { Args: { p: string }; Returns: boolean }
      log_activity: {
        Args: {
          p_action: string
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
          p_store: string
        }
        Returns: undefined
      }
      maintain_courier_states: { Args: never; Returns: undefined }
      my_courier_id: { Args: never; Returns: string }
      new_tracking_token: { Args: never; Returns: string }
      normalize_phone: { Args: { p: string }; Returns: string }
      order_transition_allowed: {
        Args: {
          p_from: Database["public"]["Enums"]["order_status"]
          p_to: Database["public"]["Enums"]["order_status"]
        }
        Returns: boolean
      }
      place_storefront_order: {
        Args: { p_payload: Json; p_store_slug: string }
        Returns: Json
      }
      purge_location_history: { Args: never; Returns: undefined }
      quote_delivery: {
        Args: {
          p_dropoff_lat: number
          p_dropoff_lng: number
          p_package_type?: string
          p_pickup_lat: number
          p_pickup_lng: number
        }
        Returns: Json
      }
      random_code: { Args: { p_len: number }; Returns: string }
      record_payment: { Args: { p_payload: Json }; Returns: string }
      remove_store_member: {
        Args: { p_store_id: string; p_user_id: string }
        Returns: undefined
      }
      report_courier_location: {
        Args: {
          p_accuracy?: number
          p_heading?: number
          p_lat: number
          p_lng: number
          p_recorded_at?: string
          p_speed?: number
        }
        Returns: Json
      }
      revoke_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      set_order_items: {
        Args: { p_items: Json; p_order_id: string }
        Returns: undefined
      }
      set_order_status: {
        Args: {
          p_note?: string
          p_order_id: string
          p_status: Database["public"]["Enums"]["order_status"]
        }
        Returns: undefined
      }
      setting_bool: {
        Args: { p_default: boolean; p_key: string }
        Returns: boolean
      }
      setting_int: {
        Args: { p_default: number; p_key: string }
        Returns: number
      }
      shares_store_with: { Args: { p_user: string }; Returns: boolean }
      store_add_courier: {
        Args: { p_payload: Json; p_store_id: string }
        Returns: Json
      }
      store_courier_board: {
        Args: { p_store_id: string }
        Returns: {
          account_status: Database["public"]["Enums"]["courier_account_status"]
          active_jobs: number
          active_jobs_here: number
          availability: Database["public"]["Enums"]["courier_availability"]
          courier_id: string
          created_at: string
          delivered_30d: number
          effective_status: string
          full_name: string
          kind: Database["public"]["Enums"]["courier_kind"]
          last_accuracy: number
          last_lat: number
          last_lng: number
          last_location_at: string
          last_seen_at: string
          linked: boolean
          membership_status: Database["public"]["Enums"]["membership_status"]
          phone: string
          vehicle_plate: string
          vehicle_type: string
          zone: string
          zone_lat: number
          zone_lng: number
          zone_radius_km: number
        }[]
      }
      store_courier_performance: {
        Args: { p_from: string; p_store_id: string; p_to: string }
        Returns: {
          avg_delivery_minutes: number
          courier_id: string
          courier_name: string
          delivered_count: number
          failed_count: number
        }[]
      }
      store_create_courier_invite: {
        Args: { p_courier_id: string; p_store_id: string }
        Returns: string
      }
      store_daily_series: {
        Args: {
          p_from: string
          p_store_id: string
          p_to: string
          p_tz?: string
        }
        Returns: {
          bucket_day: string
          delivered_count: number
          failed_count: number
          orders_count: number
          revenue_amount: number
        }[]
      }
      store_dashboard_stats: {
        Args: { p_from: string; p_store_id: string; p_to: string }
        Returns: Json
      }
      store_set_courier_access: {
        Args: { p_active: boolean; p_courier_id: string; p_store_id: string }
        Returns: undefined
      }
      store_top_products: {
        Args: {
          p_from: string
          p_limit?: number
          p_store_id: string
          p_to: string
        }
        Returns: {
          product_name: string
          quantity_sold: number
          revenue_amount: number
        }[]
      }
      store_update_courier: {
        Args: { p_courier_id: string; p_payload: Json; p_store_id: string }
        Returns: undefined
      }
      submit_tracking_claim: {
        Args: {
          p_category: string
          p_description: string
          p_name: string
          p_phone: string
          p_token: string
        }
        Returns: string
      }
      try_uuid: { Args: { p: string }; Returns: string }
      unassign_courier: { Args: { p_job_id: string }; Returns: undefined }
      update_member_permissions: {
        Args: { p_permissions: string[]; p_store_id: string; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      assignment_status: "offered" | "accepted" | "declined" | "revoked"
      claim_status: "open" | "investigating" | "resolved" | "rejected"
      courier_account_status:
        | "invited"
        | "pending_review"
        | "active"
        | "suspended"
        | "rejected"
      courier_availability: "available" | "unavailable"
      courier_kind: "private" | "platform"
      invitation_kind: "staff" | "courier"
      job_source: "store_order" | "on_demand"
      job_status:
        | "pending"
        | "offered"
        | "accepted"
        | "picked_up"
        | "in_transit"
        | "delivered"
        | "failed"
        | "cancelled"
      membership_status: "active" | "suspended"
      order_source: "storefront" | "whatsapp" | "manual" | "phone" | "other"
      order_status:
        | "new"
        | "confirmed"
        | "preparing"
        | "ready_for_pickup"
        | "handed_to_courier"
        | "in_transit"
        | "delivered"
        | "cancelled"
        | "delivery_failed"
      payment_method:
        | "cash_on_delivery"
        | "manual"
        | "orange_money"
        | "mtn_momo"
        | "other"
      payment_status: "unpaid" | "pending" | "paid" | "refunded"
      product_status: "active" | "inactive" | "archived"
      store_role: "owner" | "staff"
      store_status: "active" | "suspended"
      transaction_status:
        | "pending"
        | "confirmed"
        | "failed"
        | "refunded"
        | "cancelled"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      assignment_status: ["offered", "accepted", "declined", "revoked"],
      claim_status: ["open", "investigating", "resolved", "rejected"],
      courier_account_status: [
        "invited",
        "pending_review",
        "active",
        "suspended",
        "rejected",
      ],
      courier_availability: ["available", "unavailable"],
      courier_kind: ["private", "platform"],
      invitation_kind: ["staff", "courier"],
      job_source: ["store_order", "on_demand"],
      job_status: [
        "pending",
        "offered",
        "accepted",
        "picked_up",
        "in_transit",
        "delivered",
        "failed",
        "cancelled",
      ],
      membership_status: ["active", "suspended"],
      order_source: ["storefront", "whatsapp", "manual", "phone", "other"],
      order_status: [
        "new",
        "confirmed",
        "preparing",
        "ready_for_pickup",
        "handed_to_courier",
        "in_transit",
        "delivered",
        "cancelled",
        "delivery_failed",
      ],
      payment_method: [
        "cash_on_delivery",
        "manual",
        "orange_money",
        "mtn_momo",
        "other",
      ],
      payment_status: ["unpaid", "pending", "paid", "refunded"],
      product_status: ["active", "inactive", "archived"],
      store_role: ["owner", "staff"],
      store_status: ["active", "suspended"],
      transaction_status: [
        "pending",
        "confirmed",
        "failed",
        "refunded",
        "cancelled",
      ],
    },
  },
} as const
