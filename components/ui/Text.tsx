/**
 * Text Components
 *
 * Typography components using the Accord design system.
 * - Headers use Plus Jakarta Sans
 * - Body text uses Inter
 *
 * All components support dark mode automatically.
 */

import React from 'react';
import { Text as RNText, TextProps as RNTextProps } from 'react-native';
import { cn } from '@/lib/cn';

interface TextProps extends RNTextProps {
  className?: string;
  children: React.ReactNode;
}

/**
 * Display - Large hero text (40px)
 * Use for splash screens, hero sections
 */
export function Display({ className, children, ...props }: TextProps) {
  return (
    <RNText
      className={cn('text-display font-display-bold text-foreground', className)}
      {...props}
    >
      {children}
    </RNText>
  );
}

/**
 * H1 - Main page title (32px)
 */
export function H1({ className, children, ...props }: TextProps) {
  return (
    <RNText
      className={cn('text-heading-2xl font-display-bold text-foreground', className)}
      {...props}
    >
      {children}
    </RNText>
  );
}

/**
 * H2 - Section title (28px)
 */
export function H2({ className, children, ...props }: TextProps) {
  return (
    <RNText
      className={cn('text-heading-xl font-display-semibold text-foreground', className)}
      {...props}
    >
      {children}
    </RNText>
  );
}

/**
 * H3 - Subsection title (24px)
 */
export function H3({ className, children, ...props }: TextProps) {
  return (
    <RNText
      className={cn('text-heading-lg font-display-semibold text-foreground', className)}
      {...props}
    >
      {children}
    </RNText>
  );
}

/**
 * H4 - Card title (20px)
 */
export function H4({ className, children, ...props }: TextProps) {
  return (
    <RNText
      className={cn('text-heading font-display-medium text-foreground', className)}
      {...props}
    >
      {children}
    </RNText>
  );
}

/**
 * H5 - Small heading (18px)
 */
export function H5({ className, children, ...props }: TextProps) {
  return (
    <RNText
      className={cn('text-heading-sm font-display-medium text-foreground', className)}
      {...props}
    >
      {children}
    </RNText>
  );
}

/**
 * Body - Default body text (16px)
 * Optimized for readability with 1.5x line height
 */
export function Body({ className, children, ...props }: TextProps) {
  return (
    <RNText
      className={cn('text-body font-sans text-foreground leading-relaxed', className)}
      {...props}
    >
      {children}
    </RNText>
  );
}

/**
 * BodyLarge - Emphasized body text (17px)
 * Use for important paragraphs, introductions
 */
export function BodyLarge({ className, children, ...props }: TextProps) {
  return (
    <RNText
      className={cn('text-body-lg font-sans text-foreground leading-relaxed', className)}
      {...props}
    >
      {children}
    </RNText>
  );
}

/**
 * BodySmall - Secondary body text (14px)
 * Use for captions, helper text
 */
export function BodySmall({ className, children, ...props }: TextProps) {
  return (
    <RNText
      className={cn('text-body-sm font-sans text-foreground', className)}
      {...props}
    >
      {children}
    </RNText>
  );
}

/**
 * Label - Form labels, button text (16px medium)
 */
export function Label({ className, children, ...props }: TextProps) {
  return (
    <RNText
      className={cn('text-body font-sans-medium text-foreground', className)}
      {...props}
    >
      {children}
    </RNText>
  );
}

/**
 * Muted - Secondary/muted text
 * Use for timestamps, placeholder text, hints
 */
export function Muted({ className, children, ...props }: TextProps) {
  return (
    <RNText
      className={cn('text-body-sm font-sans text-muted-foreground', className)}
      {...props}
    >
      {children}
    </RNText>
  );
}

/**
 * Link - Clickable text in lavender
 */
export function Link({ className, children, ...props }: TextProps) {
  return (
    <RNText
      className={cn(
        'text-body font-sans-medium text-lavender-500 dark:text-lavender-400',
        'active:opacity-70',
        className
      )}
      {...props}
    >
      {children}
    </RNText>
  );
}

/**
 * Error - Error message text
 */
export function Error({ className, children, ...props }: TextProps) {
  return (
    <RNText
      className={cn('text-body-sm font-sans text-destructive', className)}
      {...props}
    >
      {children}
    </RNText>
  );
}

/**
 * Generic Text component with variant support
 */
type TextVariant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'body'
  | 'body-lg'
  | 'body-sm'
  | 'label'
  | 'muted'
  | 'link'
  | 'error';

interface VariantTextProps extends TextProps {
  variant?: TextVariant;
}

export function Text({ variant = 'body', ...props }: VariantTextProps) {
  const components: Record<TextVariant, React.FC<TextProps>> = {
    display: Display,
    h1: H1,
    h2: H2,
    h3: H3,
    h4: H4,
    h5: H5,
    body: Body,
    'body-lg': BodyLarge,
    'body-sm': BodySmall,
    label: Label,
    muted: Muted,
    link: Link,
    error: Error,
  };

  const Component = components[variant];
  return <Component {...props} />;
}

export default Text;
