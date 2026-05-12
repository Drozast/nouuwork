import { Timestamp } from 'firebase/firestore';

export interface NouuUser {
  uid: string;
  displayName: string;
  email: string;
  phone?: string;
  photoURL?: string;
  coverPhotoURL?: string;
  rut?: string;
  bio?: string;
  profession?: string;
  specialty?: string;
  experience?: string;
  education?: string;
  availability?: string;
  skills?: string[];
  services?: string[];
  location?: { lat: number; lng: number; city: string };
  rating: number;
  reviewCount: number;
  completedJobs: number;
  publishedJobs: number;
  isVerified: boolean;
  phoneVerified: boolean;
  emailVerified?: boolean;
  identityVerified?: boolean;
  role: 'user' | 'admin' | 'business';
  accountType?: 'individual' | 'business';
  companyId?: string;
  favorites?: string[];
  profileCompletionScore?: number;
  createdAt: Timestamp;
}

export interface Company {
  id: string;
  name: string;
  rut: string;
  logo?: string;
  description?: string;
  industry: string;
  size: 'small' | 'medium' | 'large';
  website?: string;
  address?: string;
  verified: boolean;
  ownerId: string;
  members: string[];
  plan: 'free' | 'professional';
  subscriptionStatus: 'active' | 'trial' | 'expired' | 'cancelled' | 'none';
  subscriptionStart?: Timestamp;
  subscriptionEnd?: Timestamp;
  postedJobsCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Nouu {
  id: string;
  type: 'informal';
  title: string;
  description: string;
  category: NouuCategory;
  location: {
    lat: number;
    lng: number;
    address: string;
    city: string;
    commune: string;
  };
  budget: number;
  budgetType: 'fixed' | 'negotiable';
  paymentMethod: 'cash' | 'transfer' | 'both';
  photos: string[];
  publisherId: string;
  publisherName: string;
  publisherPhoto: string;
  publisherRating: number;
  status: 'active' | 'assigned' | 'completed' | 'cancelled' | 'expired';
  assignedSolverId?: string;
  proposalCount: number;
  viewCount: number;
  expiresAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  renewalCount: number;
}

export type NouuCategory =
  | 'hogar'
  | 'construccion'
  | 'tecnologia'
  | 'transporte'
  | 'cuidados'
  | 'eventos'
  | 'educacion'
  | 'oficina'
  | 'belleza'
  | 'salud'
  | 'gastronomia'
  | 'otro';

export interface FormalJob {
  id: string;
  type: 'formal';
  title: string;
  company: string;
  description: string;
  requirements: string[];
  category: JobCategory;
  contractType: 'full_time' | 'part_time' | 'contract' | 'internship';
  modality: 'presencial' | 'remoto' | 'hibrido';
  salary?: { min?: number; max?: number; currency: 'CLP' | 'USD' };
  location: {
    lat: number;
    lng: number;
    address?: string;
    city: string;
    commune?: string;
    region: string;
  };
  source: 'computrabajo' | 'trabajando' | 'chiletrabajoss' | 'jooble' | 'empleos_publicos' | 'direct';
  sourceUrl: string;
  publishedAt: Timestamp;
  expiresAt?: Timestamp;
  scrapedAt: Timestamp;
  hash: string;
  clickCount: number;
  candidateCount?: number;
}

export interface Application {
  id: string;
  uid: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone?: string;
  jobId: string;
  jobTitle: string;
  company: string;
  companyId?: string;
  cvData?: any;
  status: string;
  appliedAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface ApplicationNote {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: Timestamp;
}

export type JobCategory =
  | 'tecnologia'
  | 'administracion'
  | 'ventas'
  | 'salud'
  | 'educacion'
  | 'construccion'
  | 'manufactura'
  | 'gastronomia'
  | 'transporte'
  | 'comercio'
  | 'finanzas'
  | 'marketing'
  | 'juridico'
  | 'otro';

export interface MariaNouuu {
  id: string;
  type: 'maria';
  title: string;
  description: string;
  category: NouuCategory;
  budget?: number;
  location: {
    lat: number;
    lng: number;
    address: string;
    city: string;
  };
  source: 'facebook' | 'instagram' | 'marketplace' | 'whatsapp' | 'other';
  sourceUrl?: string;
  screenshotUrl?: string;
  ownerContact: {
    name: string;
    whatsapp?: string;
    phone?: string;
    email?: string;
    messenger?: string;
  };
  addedBy: string;
  status: 'active' | 'resolved' | 'expired';
  applicationCount: number;
  expiresAt: Timestamp;
  createdAt: Timestamp;
}

export interface Proposal {
  id: string;
  nouuId: string;
  solverId: string;
  solverName: string;
  solverPhoto: string;
  solverRating: number;
  price: number;
  message: string;
  estimatedTime: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Timestamp;
}

export interface Chat {
  id: string;
  participants: string[]; // uids
  nouuId?: string;
  lastMessage: string;
  lastUpdatedAt: Timestamp;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  type: 'text' | 'image' | 'audio';
  mediaUrl?: string;
  createdAt: Timestamp;
  read: boolean;
}

export interface Review {
  id: string;
  reviewerId: string;
  revieweeId: string;
  nouuId: string;
  rating: number;
  comment?: string;
  createdAt: Timestamp;
}

export interface Subscription {
  uid: string;
  plan: 'free' | 'premium';
  startDate: Timestamp;
  endDate: Timestamp;
  discountCode?: string;
  status: 'active' | 'expired' | 'cancelled';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DiscountCode {
  id: string;
  code: string;
  monthsFree: number;
  maxUses: number;
  currentUses: number;
  isActive: boolean;
  createdBy: string;
  createdAt: Timestamp;
}

export interface MariaUsage {
  uid: string;
  count: number;
  windowStart: Timestamp;
  lastUsed: Timestamp;
}
