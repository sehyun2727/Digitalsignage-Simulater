import type { PortableTemplateView } from '../lib/portableTemplate';

export const SUPPORTED_LOCALES = ['ja', 'ko', 'en'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'ja';

export function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export interface Messages {
  appTitle: string;
  editorCrashTitle: string;
  editorCrashDescription: string;
  editorCrashReloadButton: string;
  languageSelectorLabel: string;
  localeName: Record<Locale, string>;
  hullCtaLabel: string;
  hullCtaExternalNotice: string;

  editorAddTextButton: string;
  editorAddImageButton: string;
  editorDeleteButton: string;
  editorUndoButton: string;
  editorRedoButton: string;
  editorResetButton: string;
  editorResetConfirm: string;
  editorExportButton: string;
  editorExportVideoButton: string;
  editorExportVideoInProgressButton: string;
  editorExportVideoUnsupportedHint: string;
  editorExportedVideoAnnouncement: string;
  editorExportVideoErrorAnnouncement: string;
  editorContentVideoAutoplayHint: string;
  editorCanvasEmptyHint: string;
  editorCanvasNoSignageHint: string;
  editorPropertiesTitle: string;
  editorPropertiesEmptyHint: string;
  editorPositionXLabel: string;
  editorPositionYLabel: string;
  editorWidthLabel: string;
  editorHeightLabel: string;
  editorRotationLabel: string;
  editorTextContentLabel: string;
  editorFontSizeLabel: string;
  editorTextColorLabel: string;
  editorTextAlignLabel: string;
  editorAlignLeft: string;
  editorAlignCenter: string;
  editorAlignRight: string;
  editorImageUploadErrorUnsupportedType: string;
  editorImageUploadErrorTooLarge: string;
  editorImageUploadErrorDecodeFailed: string;
  editorImageUploadErrorDimensionsTooLarge: string;
  editorContentDropNoTargetHint: string;
  editorVideoUploadErrorUnsupportedType: string;
  editorVideoUploadErrorTooLarge: string;
  editorVideoUploadErrorUnsupportedCodec: string;
  editorVideoUploadErrorDecodeFailed: string;
  editorVideoUploadErrorDimensionsTooLarge: string;
  editorVideoUploadErrorDurationTooLong: string;
  editorExportedAnnouncement: string;
  editorExportedIosAnnouncement: string;
  editorExportErrorAnnouncement: string;

  editorCanvasPresetLabel: string;
  editorCanvasPresetLandscapeLabel: string;
  editorCanvasPresetPortraitLabel: string;

  editorSpaceBackgroundLabel: string;
  editorAddSpaceBackgroundButton: string;
  editorReplaceSpaceBackgroundButton: string;
  editorRemoveSpaceBackgroundButton: string;
  toolbarSpaceEmptyHint: string;
  editorSpaceBackgroundDimensionsLabel: string;
  editorSpaceBackgroundDownscaledNotice: string;
  editorSpaceBackgroundPrivacyNotice: string;

  editorAddLedButton: string;
  editorAddLcdButton: string;
  editorAddTransparentLedButton: string;
  toolbarAddSignageDisabledHint: string;

  editorContentLabel: string;
  editorContentUploadButton: string;
  editorContentReplaceButton: string;
  editorContentRemoveButton: string;
  editorContentNoneHint: string;
  editorContentFitLabel: string;
  editorContentFitContain: string;
  editorContentFitCover: string;
  editorContentRotationLabel: string;
  editorContentRotationZero: string;
  editorContentRotationNinety: string;
  editorContentOffsetXLabel: string;
  editorContentOffsetYLabel: string;
  editorContentScaleLabel: string;
  editorContentResetButton: string;
  editorContentAdvancedSettingsOpenButton: string;

  editorRenderingPresetLabel: string;
  editorRenderingPresetNatural: string;
  editorRenderingPresetBright: string;
  editorRenderingPresetNight: string;
  editorRenderingPresetHint: string;

  editorMaterialLabel: string;
  editorMaterialLed: string;
  editorMaterialLcd: string;
  editorMaterialTransparentLed: string;
  editorMaterialIntensityLabel: string;
  editorMaterialBrightnessLabel: string;
  editorMaterialTransparencyLabel: string;
  editorMaterialGridDensityLabel: string;
  editorMaterialGlowLabel: string;
  editorMaterialContrastLabel: string;
  editorMaterialResetButton: string;
  editorMaterialPreviewNotice: string;
  editorTransparentLedDisclaimer: string;
  editorAdvancedSettingsOpenButton: string;
  editorAdvancedSettingsTitle: string;
  editorAdvancedSettingsCloseButton: string;

  editorCurvatureModeLabel: string;
  editorCurvatureFlat: string;
  editorCurvatureConcave: string;
  editorCurvatureConvex: string;
  editorCurvatureAmountLabel: string;
  editorCurvatureResetButton: string;
  editorCurvatureUnsupportedHint: string;

  editorContactShadowLabel: string;
  editorContactShadowEnableLabel: string;
  editorContactShadowStrengthLabel: string;
  editorContactShadowBlurLabel: string;
  editorContactShadowOffsetXLabel: string;
  editorContactShadowOffsetYLabel: string;
  editorContactShadowSpreadLabel: string;
  editorContactShadowDepthLabel: string;
  editorContactShadowTintLabel: string;
  editorContactShadowResetButton: string;
  editorEnvironmentIntegrationLabel: string;
  editorEnvironmentIntegrationStrengthLabel: string;
  editorEnvironmentIntegrationResetButton: string;
  editorEnvironmentSampleButton: string;
  editorEnvironmentSampledSwatchLabel: string;
  editorEnvironmentSampleNoSpaceHint: string;

  editorPerspectiveFitButton: string;
  editorPerspectiveUseRectButton: string;
  editorPerspectiveHint: string;
  editorPerspectiveCornerTopLeft: string;
  editorPerspectiveCornerTopRight: string;
  editorPerspectiveCornerBottomRight: string;
  editorPerspectiveCornerBottomLeft: string;
  editorPerspectiveApplyButton: string;
  editorPerspectiveCancelButton: string;
  editorPerspectiveResetButton: string;
  editorPerspectiveErrorOutOfBounds: string;
  editorPerspectiveErrorSelfIntersecting: string;
  editorPerspectiveErrorConcave: string;
  editorPerspectiveErrorMinArea: string;
  editorPerspectiveErrorMinEdge: string;
  editorPerspectiveErrorInvalidValues: string;

  editorInstallationModeLabel: string;
  editorInstallationModeWall: string;
  editorInstallationModeWindow: string;
  editorInstallationModeFreestanding: string;

  editorOcclusionLabel: string;
  editorOcclusionMaskItemLabel: string;
  editorOcclusionEmptyHint: string;
  editorOcclusionAddButton: string;
  editorOcclusionEditButton: string;
  editorOcclusionDeleteButton: string;
  editorOcclusionEnableLabel: string;
  editorOcclusionPointLabel: string;
  editorOcclusionHint: string;
  editorOcclusionFeatherLabel: string;
  editorOcclusionOpacityLabel: string;
  editorOcclusionApplyButton: string;
  editorOcclusionCancelButton: string;
  editorOcclusionNoSpaceHint: string;
  editorOcclusionErrorTooFewPoints: string;
  editorOcclusionErrorTooManyPoints: string;
  editorOcclusionErrorInvalidValues: string;
  editorOcclusionErrorOutOfBounds: string;
  editorOcclusionErrorDuplicatePoints: string;
  editorOcclusionErrorSelfIntersecting: string;
  editorOcclusionErrorMinArea: string;

  editorAddPortableButton: string;
  portableViewLabel: string;
  /** One label per entry in `PORTABLE_TEMPLATE_VIEWS`. Keyed by view id so the toolbar's
   *  selector can drive both the value and the label from the same PORTABLE_TEMPLATE_VIEWS
   *  list — see `src/features/editor/Toolbar.tsx`. */
  portableViewOptions: Record<PortableTemplateView, string>;
  portableProductPhotoLabel: string;
  portableUploadProductPhotoButton: string;
  portableReplaceProductPhotoButton: string;
  portableRemoveProductPhotoButton: string;
  portableScreenQuadEditButton: string;
  portableScreenQuadResetButton: string;
  portableScreenQuadHint: string;
  portableScreenQuadApplyButton: string;
  portableScreenQuadCancelButton: string;
  portableScreenQuadNoPhotoHint: string;
  portableScreenQuadBackgroundHint: string;

  toolbarAriaLabel: string;
  toolbarSpaceSectionHeading: string;
  toolbarAddSignageSectionHeading: string;
  toolbarAddElementSubheading: string;
  toolbarSelectedSignageSectionHeading: string;
  toolbarAppearanceSectionHeading: string;
  toolbarExportSectionHeading: string;
  toolbarContentEmptyHint: string;
  toolbarAppearanceEmptyHint: string;
  toolbarAppearanceUnsupportedHint: string;
  toolbarSelectedSignageTypeLabel: string;
  toolbarExportDisabledReason: string;
  signageTypeText: string;
  signageTypeImage: string;
  signageTypeLed: string;
  signageTypeLcd: string;
  signageTypeTransparentLed: string;
  signageTypePortable: string;
  exportResolutionLabel: string;

  headerCompareToOriginalButton: string;
  headerCompareToResultButton: string;

  comparisonToggleGroupLabel: string;
  comparisonResultLabel: string;
  comparisonOriginalLabel: string;
  comparisonOriginalNoSpaceHint: string;

  statusBarHintNoSpace: string;
  statusBarHintNoSignage: string;
  statusBarHintNoContent: string;
  statusBarHintReady: string;

  onboardingTitle: string;
  onboardingDescription: string;
  onboardingDismissButton: string;
  onboardingStep1Title: string;
  onboardingStep1Description: string;
  onboardingStep1CtaLabel: string;
  onboardingStep2Title: string;
  onboardingStep2Description: string;
  onboardingStep2CtaLabel: string;
  onboardingStep3Title: string;
  onboardingStep3Description: string;
  onboardingStep3CtaLabel: string;
  onboardingStep4Title: string;
  onboardingStep4Description: string;
  onboardingStep4CtaLabel: string;

  realismGuideTitle: string;
  realismGuideDescription: string;
  realismGuideStepPreset: string;
  realismGuideStepInstallation: string;
  realismGuideStepEnvironment: string;
  realismGuideStepOcclusion: string;
  realismGuideDismissButton: string;

  salesReviewEnterButton: string;
  salesReviewExitButton: string;
  salesReviewModeHint: string;

  userGuideOpenButton: string;
  userGuideTitle: string;
  userGuideCloseButton: string;
  userGuideAboutHeading: string;
  userGuideAboutBody: string;
  userGuideHowHeading: string;
  userGuideHowSteps: readonly string[];
  userGuideSignageHeading: string;
  userGuideSignageItems: readonly string[];
  userGuideContentHeading: string;
  userGuideContentItems: readonly string[];
  userGuideRealismHeading: string;
  userGuideRealismItems: readonly string[];
  userGuidePerspectiveHeading: string;
  userGuidePerspectiveItems: readonly string[];
  userGuideOverlaysHeading: string;
  userGuideOverlaysBody: string;
  userGuideTipsHeading: string;
  userGuideTipsItems: readonly string[];
  userGuideDataHeading: string;
  userGuideDataItems: readonly string[];
  userGuideExportHeading: string;
  userGuideExportBody: string;
}
