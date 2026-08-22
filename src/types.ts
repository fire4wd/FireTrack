export interface AppDesignSystem {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  fontStyle: string;
  overallStyle: string;
}

export interface AppScreenComponent {
  id: string;
  type: 'button' | 'input' | 'list' | 'card' | 'chart' | 'text' | 'image' | 'toggle' | 'custom';
  label: string;
  placeholder?: string;
  action?: string;
  value?: string | number | boolean;
}

export interface AppScreen {
  id: string;
  name: string;
  description: string;
  components: AppScreenComponent[];
  keyActions: string[];
}

export interface AppFeature {
  id: string;
  title: string;
  description: string;
  priority: 'Alta' | 'Media' | 'Bassa';
  completed?: boolean;
}

export interface DataEntity {
  id: string;
  entity: string;
  fields: string[];
}

export interface AppBlueprint {
  id: string;
  appName: string;
  category: string;
  versionOriginal?: string;
  yearOriginal?: string;
  summary: string;
  designSystem: AppDesignSystem;
  screens: AppScreen[];
  features: AppFeature[];
  dataModel: DataEntity[];
  recommendations: string[];
  mockData?: Record<string, any[]>;
  userNotes?: string;
  createdAt: string;
}

export interface ImageAttachment {
  id: string;
  url: string;
  name: string;
}
