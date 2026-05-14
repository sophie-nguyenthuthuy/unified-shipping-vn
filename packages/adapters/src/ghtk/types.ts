/**
 * Wire-shape types for the GHTK partner API. These mirror what the API returns
 * verbatim, including snake_case fields. The adapter is the only place these
 * leak; everywhere else uses normalised `@usv/core` types.
 */

export interface GhtkErrorPayload {
  success: false;
  message: string;
}

export interface GhtkFeeResponse {
  success: boolean;
  message?: string;
  fee?: {
    name: string;
    fee: number;
    insurance_fee: number;
    include_vat?: number;
    cost_id?: number;
    delivery_type?: string;
    delivery?: boolean;
    extFees?: Array<{ display: string; title: string; amount: number; type: string }>;
    /** Estimated delivery (ISO-ish carrier-local). */
    a?: number;
    dt?: string;
    options?: { name: string; title: string; cost_id: number; goods_value: number };
  };
}

export interface GhtkCreateOrderRequest {
  products: Array<{
    name: string;
    weight: number; // kg (GHTK uses kg as float)
    quantity: number;
    product_code?: string;
    price?: number;
  }>;
  order: {
    id: string;
    pick_name: string;
    pick_money: number; // COD amount
    pick_address_id?: string;
    pick_address: string;
    pick_province: string;
    pick_district: string;
    pick_ward?: string;
    pick_tel: string;
    tel: string;
    name: string;
    address: string;
    province: string;
    district: string;
    ward?: string;
    hamlet?: string;
    is_freeship: 0 | 1;
    pick_date?: string;
    pick_option?: "cod" | "post";
    deliver_option?: "none" | "xteam" | "standard";
    transport?: "fly" | "road";
    note?: string;
    value: number; // declared value
    weight_option?: "kilogram" | "gram";
    total_weight?: number;
    use_return_address?: 0 | 1;
    return_name?: string;
    return_address?: string;
    return_province?: string;
    return_district?: string;
    return_ward?: string;
    return_tel?: string;
    return_email?: string;
  };
}

export interface GhtkCreateOrderResponse {
  success: boolean;
  message?: string;
  order?: {
    partner_id: string;
    label: string; // GHTK tracking code (e.g. "S12345.A6789")
    area: number;
    fee: number; // shipping fee
    insurance_fee: number;
    estimated_pick_time: string;
    estimated_deliver_time: string;
    products: unknown[];
    status_id: number;
    tracking_id?: number;
  };
}

export interface GhtkCancelResponse {
  success: boolean;
  message?: string;
}

export interface GhtkOrderDetailResponse {
  success: boolean;
  message?: string;
  order?: {
    label_id: string;
    partner_id: string;
    status: string; // numeric as string
    status_text: string;
    created: string;
    modified: string;
    message: string;
    pick_money: number;
    value: number;
    customer_fullname: string;
    customer_tel: string;
    address: string;
    storage_day?: number;
    ship_money?: number;
    insurance?: number;
    weight?: number;
    pick_date?: string;
    deliver_date?: string;
    customer_pay_ship?: number;
    log?: Array<{
      action_time: string;
      action: string;
      status_text?: string;
      reason?: string;
    }>;
  };
}

export interface GhtkWebhookPayload {
  label_id: string;
  partner_id: string;
  /** Status as a numeric string. */
  status_id: string | number;
  action_time?: string;
  reason_code?: string;
  reason?: string;
  weight?: number;
  fee?: number;
  pick_money?: number;
}

export interface GhtkRemittanceLine {
  label_id: string;
  partner_id?: string;
  total_fee?: number;
  pick_money: number;
  fee: number;
  insurance_fee?: number;
  /** Net remitted to merchant after fees. */
  total_collect: number;
  status?: number;
  paid_date?: string;
  delivered_date?: string;
}
