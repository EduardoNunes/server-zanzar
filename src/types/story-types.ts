export interface StoreDataProps {
  name: string;
  description: string;
  logo: File;
  banner: File;
  address?: {
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}