import React from 'react';
import { Img } from 'remotion';

interface BannerOverlayProps {
  // Legacy single-image banner
  src?: string;
  // Composite banner parts
  topSrc?: string;
  bottomSrc?: string;
  titleText?: string;
  style?: React.CSSProperties;
}

export const BannerOverlay: React.FC<BannerOverlayProps> = ({
  src,
  topSrc,
  bottomSrc,
  titleText,
  style
}) => {
  const hasComposite = topSrc && bottomSrc && typeof titleText === 'string' && titleText.length > 0;

  if (!hasComposite && src) {
    // Fallback: legacy single-image banner
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          ...style
        }}
      >
        <Img
          src={src}
          style={{
            maxWidth: '70%',
            height: 'auto',
            objectFit: 'contain',
            filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3))',
            imageRendering: 'crisp-edges',
            borderRadius: 16
          }}
        />
      </div>
    );
  }

  // Composite: top png, dynamic white box with left-aligned text, bottom png
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        ...style
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0,
          // Limit max width for readability; auto width by content in middle box
          maxWidth: '80%'
        }}
      >
        {/* Top banner image with rounded top corners */}
        {topSrc && (
          <Img
            src={topSrc}
            style={{
              width: '100%',
              height: 'auto',
              objectFit: 'contain',
              filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3))',
              imageRendering: 'crisp-edges',
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18
            }}
          />
        )}

        {/* Middle white box with dynamic width and left-aligned text */}
        <div
          style={{
            display: 'inline-block',
            background: '#ffffff',
            color: '#111827',
            padding: '16px 20px',
            width: 'auto',
            alignSelf: 'stretch',
            // Visual connection to top/bottom without rounding here
            boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
          }}
        >
          <div
            style={{
              fontSize: 44,
              lineHeight: 1.2,
              fontWeight: 800,
              textAlign: 'left',
              wordBreak: 'break-word',
              // Text emphasis readability
              textRendering: 'optimizeLegibility',
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale'
            }}
          >
            {titleText}
          </div>
        </div>

        {/* Bottom banner image with rounded bottom corners */}
        {bottomSrc && (
          <Img
            src={bottomSrc}
            style={{
              width: '100%',
              height: 'auto',
              objectFit: 'contain',
              filter: 'drop-shadow(0 8px 16px rgba(0, 0, 0, 0.35))',
              imageRendering: 'crisp-edges',
              borderBottomLeftRadius: 18,
              borderBottomRightRadius: 18
            }}
          />
        )}
      </div>
    </div>
  );
}; 