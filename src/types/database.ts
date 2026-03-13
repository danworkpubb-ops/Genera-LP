export interface Profile {
  id: string;
  email: string;
  full_name?: string;
}

export interface Site {
  id: string;
  user_id: string;
  name: string;
  subdomain: string;
  vercel_project_id?: string;
  github_repo_url?: string;
  status: 'deploying' | 'ready' | 'error';
  created_at: string;
}

export interface Product {
  id: string;
  site_id: string;
  name: string;
  description: string;
  price: number;
  image_url?: string;
}

export interface Order {
  id: string;
  site_id: string;
  product_id: string;
  customer_name: string;
  customer_address: string;
  customer_phone: string;
  status: 'pending' | 'shipped' | 'delivered' | 'cancelled';
  created_at: string;
}
