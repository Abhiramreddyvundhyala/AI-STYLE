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
      styles: {
        Row: {
          id: string
          title: string
          category: string
          price: number
          sample_image_url: string
          prompt: string // Plain text, NEVER expose to frontend (RLS protected)
          description: string | null
          seller_id: string
          sales_count: number
          avg_rating: number
          is_active: boolean
          created_at: string
          tags: string[] | null
        }
        Insert: {
          id?: string
          title: string
          category: string
          price: number
          sample_image_url: string
          prompt: string
          description?: string | null
          seller_id: string
          sales_count?: number
          avg_rating?: number
          is_active?: boolean
          created_at?: string
          tags?: string[] | null
        }
        Update: {
          id?: string
          title?: string
          category?: string
          price?: number
          sample_image_url?: string
          prompt?: string
          description?: string | null
          seller_id?: string
          sales_count?: number
          avg_rating?: number
          is_active?: boolean
          created_at?: string
          tags?: string[] | null
        }
      }
      sellers: {
        Row: {
          id: string
          display_name: string
          upi_id: string | null
          bank_account: string | null
          total_earnings: number
          pending_withdrawal: number
          is_verified: boolean
          created_at: string
        }
        Insert: {
          id: string
          display_name: string
          upi_id?: string | null
          bank_account?: string | null
          total_earnings?: number
          pending_withdrawal?: number
          is_verified?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          display_name?: string
          upi_id?: string | null
          bank_account?: string | null
          total_earnings?: number
          pending_withdrawal?: number
          is_verified?: boolean
          created_at?: string
        }
      }
      purchases: {
        Row: {
          id: string
          buyer_id: string
          style_id: string
          amount: number
          platform_cut: number
          seller_cut: number
          razorpay_payment_id: string | null
          razorpay_order_id: string | null
          hd_image_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          buyer_id: string
          style_id: string
          amount: number
          platform_cut: number
          seller_cut: number
          razorpay_payment_id?: string | null
          razorpay_order_id?: string | null
          hd_image_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          buyer_id?: string
          style_id?: string
          amount?: number
          platform_cut?: number
          seller_cut?: number
          razorpay_payment_id?: string | null
          razorpay_order_id?: string | null
          hd_image_url?: string | null
          created_at?: string
        }
      }
      ratings: {
        Row: {
          id: string
          buyer_id: string
          style_id: string
          stars: number
          review_text: string | null
          created_at: string
        }
        Insert: {
          id?: string
          buyer_id: string
          style_id: string
          stars: number
          review_text?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          buyer_id?: string
          style_id?: string
          stars?: number
          review_text?: string | null
          created_at?: string
        }
      }
      withdrawals: {
        Row: {
          id: string
          seller_id: string
          amount: number
          upi_id: string
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          seller_id: string
          amount: number
          upi_id: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          seller_id?: string
          amount?: number
          upi_id?: string
          status?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
