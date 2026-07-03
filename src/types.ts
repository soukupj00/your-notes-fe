export interface ButtonViewReturnComponentProps {
  action?: () => void;
  isActive?: () => boolean;
  icon?: string;
  tooltip?: string;
}
