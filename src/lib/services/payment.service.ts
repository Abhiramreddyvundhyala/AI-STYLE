/**
 * Payment Service
 * Handles Razorpay payment integration
 */

import { supabase } from '../supabase';
import type { RazorpayOrder, PaymentVerification } from '../types/database';
import { PLATFORM_CUT_PERCENTAGE, SELLER_CUT_PERCENTAGE } from '../types/database';

declare global {
  interface Window {
    Razorpay: any;
  }
}

class PaymentService {
  private razorpayKeyId: string;

  constructor() {
    this.razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID || '';
  }

  /**
   * Load Razorpay script
   */
  async loadRazorpayScript(): Promise<boolean> {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  /**
   * Calculate payment splits
   */
  calculateSplits(amount: number) {
    const platformCut = Math.round((amount * PLATFORM_CUT_PERCENTAGE) / 100);
    const sellerCut = amount - platformCut;

    return {
      amount,
      platformCut,
      sellerCut,
    };
  }

  /**
   * Create Razorpay order
   */
  async createOrder(styleId: string, amount: number): Promise<RazorpayOrder> {
    const { data, error } = await supabase.functions.invoke('create-payment-order', {
      body: { styleId, amount },
    });

    if (error) throw error;
    return data as RazorpayOrder;
  }

  /**
   * Open Razorpay checkout
   */
  async openCheckout(
    order: RazorpayOrder,
    styleId: string,
    onSuccess: (paymentId: string) => void,
    onFailure: (error: any) => void
  ) {
    const scriptLoaded = await this.loadRazorpayScript();
    if (!scriptLoaded) {
      throw new Error('Failed to load Razorpay SDK');
    }

    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('User not authenticated');

    const options = {
      key: this.razorpayKeyId,
      amount: order.amount,
      currency: order.currency,
      name: 'PromptStyle',
      description: 'AI Style Purchase',
      order_id: order.id,
      prefill: {
        email: user.email,
        name: user.user_metadata?.display_name || user.email,
      },
      theme: {
        color: '#FF6B35',
      },
      handler: async (response: PaymentVerification) => {
        try {
          await this.verifyPayment(response, styleId);
          onSuccess(response.razorpay_payment_id);
        } catch (error) {
          onFailure(error);
        }
      },
      modal: {
        ondismiss: () => {
          onFailure(new Error('Payment cancelled'));
        },
      },
    };

    const razorpay = new window.Razorpay(options);
    razorpay.open();
  }

  /**
   * Verify payment signature
   */
  async verifyPayment(
    verification: PaymentVerification,
    styleId: string
  ): Promise<void> {
    const { error } = await supabase.functions.invoke('verify-payment', {
      body: { ...verification, styleId },
    });

    if (error) throw error;
  }

  /**
   * Process purchase after successful payment
   */
  async processPurchase(
    styleId: string,
    paymentId: string,
    orderId: string,
    amount: number
  ) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('User not authenticated');

    const splits = this.calculateSplits(amount);

    const { data, error } = await supabase.functions.invoke('process-purchase', {
      body: {
        buyerId: user.id,
        styleId,
        paymentId,
        orderId,
        ...splits,
      },
    });

    if (error) throw error;
    return data;
  }
}

export const paymentService = new PaymentService();
export default paymentService;
