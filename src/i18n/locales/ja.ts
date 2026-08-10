import type { Messages } from '../../types/i18n';

export const ja: Messages = {
  appTitle: 'Digital Signage Simulator',
  disclaimer:
    '本サービスは個人が企画・運営する独立したデジタルサイネージシミュレーションツールであり、HULL株式会社の公式サービスではありません。',
  languageSelectorLabel: '言語',
  localeName: {
    ja: '日本語',
    ko: '한국어',
    en: 'English',
  },
  hullCtaLabel: 'HULLに問い合わせる',
  hullCtaExternalNotice: '外部のHULL公式サイトが新しいタブで開きます。',

  editorTemplateLabel: 'テンプレート',
  editorTemplateWallLed: '壁掛けLED',
  editorTemplateStandDisplay: 'スタンド型ディスプレイ',
  editorAddTextButton: 'テキストを追加',
  editorAddImageButton: '画像を追加',
  editorDeleteButton: '削除',
  editorUndoButton: '元に戻す',
  editorRedoButton: 'やり直す',
  editorExportButton: 'PNGで書き出す',
  editorBackgroundColorLabel: '背景色',
  editorEmptyCanvasHint: 'まだ要素がありません。テキストまたは画像を追加してください。',
  editorPropertiesTitle: 'プロパティ',
  editorPropertiesEmptyHint: '要素を選択するとプロパティを編集できます。',
  editorPositionXLabel: 'X座標',
  editorPositionYLabel: 'Y座標',
  editorWidthLabel: '幅',
  editorHeightLabel: '高さ',
  editorRotationLabel: '回転',
  editorTextContentLabel: 'テキスト内容',
  editorFontSizeLabel: 'フォントサイズ',
  editorTextColorLabel: '文字色',
  editorTextAlignLabel: '文字揃え',
  editorAlignLeft: '左揃え',
  editorAlignCenter: '中央揃え',
  editorAlignRight: '右揃え',
  editorImageUploadErrorUnsupportedType: 'PNG、JPEG、WebP形式の画像のみ利用できます。',
  editorImageUploadErrorTooLarge: '画像サイズは10MB以下にしてください。',
  editorImageUploadErrorDecodeFailed:
    '画像を読み込めませんでした。ファイルが破損している可能性があります。',
  editorExportedAnnouncement: 'PNG画像を書き出しました。',
  editorExportErrorAnnouncement: 'PNG画像の書き出しに失敗しました。もう一度お試しください。',

  editorSpaceBackgroundLabel: '空間写真',
  editorAddSpaceBackgroundButton: '空間写真を追加',
  editorRemoveSpaceBackgroundButton: '空間写真を削除',
  editorAddWallLedButton: '壁掛けLEDを追加',
  editorAddStandDisplayButton: 'スタンド型ディスプレイを追加',

  editorContentLabel: '画面コンテンツ',
  editorContentUploadButton: 'コンテンツを追加',
  editorContentReplaceButton: 'コンテンツを差し替える',
  editorContentRemoveButton: 'コンテンツを削除',
  editorContentNoneHint: 'まだコンテンツがありません。画像を追加してください。',
  editorContentFitLabel: '表示方法',
  editorContentFitContain: '全体を表示 (Contain)',
  editorContentFitCover: '画面いっぱいに表示 (Cover)',
  editorContentOffsetXLabel: 'コンテンツ位置X',
  editorContentOffsetYLabel: 'コンテンツ位置Y',
  editorContentScaleLabel: 'コンテンツ拡大率',
  editorContentResetButton: 'コンテンツ配置をリセット',

  editorMaterialLabel: 'ディスプレイ素材',
  editorMaterialOutdoorLed: '屋外LED',
  editorMaterialLcd: 'LCD',
  editorMaterialIntensityLabel: '質感の強さ',
  editorMaterialBrightnessLabel: '明るさ',
  editorMaterialResetButton: '効果をリセット',
  editorMaterialPreviewNotice:
    '画面の質感と明るさは視覚的な参考表現であり、実際の製品性能を保証するものではありません。',

  editorTemplateSectionHeading: '基本テンプレート',
  portableSectionHeading: 'マイ・ポータブル製品',
  editorAddPortableButton: 'ポータブル製品を追加',
  portableTypeLabel: '種類',
  portableTypeValue: 'ポータブル製品',

  portableBackgroundNotice:
    '背景が透明なPNGまたはWebPを使用すると、より自然に配置できます。JPGや背景付き画像では、画像の背景もそのまま表示されます。',
  portableRightsNotice:
    'アップロードする製品画像について、必要な権利または使用許可を有していることをご確認ください。画像はブラウザ内で処理され、サーバーには保存されません。',
  portableSupportedFormatsHint: 'JPG、JPEG、PNG、WebP形式の画像を利用できます。',

  portableStepSelectPhotoTitle: '製品写真を選択',
  portableStepDefineRegionTitle: '画面領域を指定',
  portableSelectPhotoButton: '製品写真を選択',
  portableChangePhotoButton: '製品写真を変更',
  portableNoPhotoSelectedHint: 'まだ写真が選択されていません。',

  portableScreenRegionDragHint: '写真上をドラッグして画面になる範囲を指定してください。',
  portableScreenRegionMoveResizeHint:
    '既に指定した範囲の内側をドラッグすると移動、四隅のハンドルをドラッグすると大きさを変更できます。キーボードでは下のX・Y・幅・高さの数値欄から同じ操作ができます。',
  portableScreenRegionXLabel: '領域X',
  portableScreenRegionYLabel: '領域Y',
  portableScreenRegionWidthLabel: '領域の幅',
  portableScreenRegionHeightLabel: '領域の高さ',
  portableScreenRegionResetButton: '領域をリセット',
  portableScreenRegionEditButton: '画面領域を編集',
  portableScreenRegionMinSizeError:
    '画面領域が小さすぎます。写真の縦横それぞれ5%以上を指定してください。',

  portableCancelButton: 'キャンセル',
  portableBackButton: '戻る',
  portableNextButton: '次へ',
  portableAddButton: '追加',
  portableSaveButton: '保存',
  portableReplacePhotoHint:
    '写真を差し替えるには、この製品を削除してから新しいポータブル製品として追加し直してください。',
};
