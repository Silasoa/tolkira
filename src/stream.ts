import { Transform, type TransformCallback } from 'node:stream';
import type { Envelope } from '@cucumber/messages';
import { renderOptions, type RenderReportOptions } from './options.js';
import { renderHtml } from './render/html.js';

/**
 * A `CucumberHtmlStream`-shaped adapter for Cucumber Messages. It collects
 * envelopes and renders one HTML document on flush with the same options and
 * renderer as `renderReport`.
 */
export class CucumberHtmlStream extends Transform {
  private readonly envelopes: Envelope[] = [];

  constructor(private readonly options: RenderReportOptions = {}) {
    super({ objectMode: true });
  }

  _transform(
    envelope: Envelope,
    _encoding: BufferEncoding,
    callback: TransformCallback,
  ): void {
    this.envelopes.push(envelope);
    callback();
  }

  _flush(callback: TransformCallback): void {
    renderHtml(this.envelopes, renderOptions(this.options)).then(
      (html) => callback(null, html),
      (error: unknown) =>
        callback(error instanceof Error ? error : new Error(String(error))),
    );
  }
}
