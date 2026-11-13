import {
  ATTACHMENT_FILE_ACCEPT,
  ATTACHMENT_MAX_SIZE,
  ATTACHMENT_MIME_TYPES,
  checkAttachmentSize,
  detectAttachmentMimeType,
  normalizeAttachmentFileName,
  validateAttachment,
} from './attachments';

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

function ascii(text: string): number[] {
  return Array.from(text, char => char.charCodeAt(0));
}

// A minimal file of each kind: the signature followed by some padding
const SAMPLES = {
  jpeg: bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...ascii('JFIF')),
  png: bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00),
  webp: bytes(...ascii('RIFF'), 0x24, 0x00, 0x00, 0x00, ...ascii('WEBPVP8 ')),
  pdf: bytes(...ascii('%PDF-1.7\n%âãÏÓ\n')),
};

describe('detectAttachmentMimeType', () => {
  it('recognizes each allowed type by its contents', () => {
    expect(detectAttachmentMimeType(SAMPLES.jpeg)).toBe('image/jpeg');
    expect(detectAttachmentMimeType(SAMPLES.png)).toBe('image/png');
    expect(detectAttachmentMimeType(SAMPLES.webp)).toBe('image/webp');
    expect(detectAttachmentMimeType(SAMPLES.pdf)).toBe('application/pdf');
  });

  it('rejects types that are not allowed', () => {
    // GIF
    expect(detectAttachmentMimeType(bytes(...ascii('GIF89a')))).toBeNull();
    // HEIC: "....ftypheic"
    expect(
      detectAttachmentMimeType(
        bytes(0x00, 0x00, 0x00, 0x18, ...ascii('ftypheic')),
      ),
    ).toBeNull();
    // Plain text and HTML
    expect(detectAttachmentMimeType(bytes(...ascii('hello')))).toBeNull();
    expect(
      detectAttachmentMimeType(bytes(...ascii('<html><body>%PDF-'))),
    ).toBeNull();
    // A RIFF file that isn't WebP (WAV audio)
    expect(
      detectAttachmentMimeType(
        bytes(...ascii('RIFF'), 0x24, 0x00, 0x00, 0x00, ...ascii('WAVEfmt ')),
      ),
    ).toBeNull();
  });

  it('rejects files too short to hold a full signature', () => {
    expect(detectAttachmentMimeType(bytes())).toBeNull();
    expect(detectAttachmentMimeType(bytes(0xff, 0xd8))).toBeNull();
    expect(detectAttachmentMimeType(bytes(0x89, 0x50, 0x4e, 0x47))).toBeNull();
    expect(detectAttachmentMimeType(bytes(...ascii('RIFF')))).toBeNull();
    expect(detectAttachmentMimeType(bytes(...ascii('%PDF')))).toBeNull();
  });

  it('reads a view with an offset from its own start', () => {
    const buffer = new Uint8Array([0x00, 0x00, ...SAMPLES.png]);
    expect(detectAttachmentMimeType(buffer.subarray(2))).toBe('image/png');
  });
});

describe('checkAttachmentSize', () => {
  it('rejects an empty file', () => {
    expect(checkAttachmentSize(0)).toEqual({ reason: 'empty' });
  });

  it('allows a file exactly at the limit and rejects one byte more', () => {
    expect(checkAttachmentSize(1)).toBeNull();
    expect(checkAttachmentSize(ATTACHMENT_MAX_SIZE)).toBeNull();
    expect(checkAttachmentSize(ATTACHMENT_MAX_SIZE + 1)).toEqual({
      reason: 'too-large',
      maxSize: ATTACHMENT_MAX_SIZE,
    });
  });

  it('uses a 10 MB limit', () => {
    expect(ATTACHMENT_MAX_SIZE).toBe(10 * 1024 * 1024);
  });
});

describe('validateAttachment', () => {
  it('accepts an allowed file and reports its detected type', () => {
    expect(validateAttachment(SAMPLES.pdf)).toEqual({
      ok: true,
      mimeType: 'application/pdf',
    });
  });

  it('rejects an empty file', () => {
    expect(validateAttachment(bytes())).toEqual({
      ok: false,
      error: { reason: 'empty' },
    });
  });

  it('rejects a file over the limit before looking at its type', () => {
    const big = new Uint8Array(ATTACHMENT_MAX_SIZE + 1);
    big.set(SAMPLES.png);
    expect(validateAttachment(big)).toEqual({
      ok: false,
      error: { reason: 'too-large', maxSize: ATTACHMENT_MAX_SIZE },
    });
  });

  it('rejects an unsupported type and lists the allowed ones', () => {
    expect(validateAttachment(bytes(...ascii('GIF89a')))).toEqual({
      ok: false,
      error: { reason: 'unsupported-type', allowed: ATTACHMENT_MIME_TYPES },
    });
  });
});

describe('ATTACHMENT_FILE_ACCEPT', () => {
  it('lists the allowed types and extensions', () => {
    expect(ATTACHMENT_FILE_ACCEPT).toBe(
      'image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf',
    );
  });
});

describe('normalizeAttachmentFileName', () => {
  it('keeps an ordinary name', () => {
    expect(normalizeAttachmentFileName('Receipt – Café.pdf')).toBe(
      'Receipt – Café.pdf',
    );
  });

  it('drops any directory part', () => {
    expect(normalizeAttachmentFileName('C:\\fakepath\\receipt.pdf')).toBe(
      'receipt.pdf',
    );
    expect(normalizeAttachmentFileName('../../etc/receipt.png')).toBe(
      'receipt.png',
    );
  });

  it('removes control characters and surrounding spaces', () => {
    expect(normalizeAttachmentFileName('  rec\u0000ei\npt.jpg ')).toBe(
      'receipt.jpg',
    );
  });

  it('falls back to a default name when nothing is left', () => {
    expect(normalizeAttachmentFileName('')).toBe('attachment');
    expect(normalizeAttachmentFileName('   ')).toBe('attachment');
    expect(normalizeAttachmentFileName('folder/')).toBe('attachment');
  });

  it('shortens long names but keeps the extension', () => {
    const name = normalizeAttachmentFileName('a'.repeat(300) + '.pdf');
    expect(name).toHaveLength(255);
    expect(name.endsWith('.pdf')).toBe(true);
  });
});
