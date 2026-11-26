import { Transform, type TransformCallback } from 'node:stream';
import type { Envelope } from '@cucumber/messages';
import { buildLoadedRun } from './loaded-run.js';
import type { RenderReportOptions } from './options.js';
import { renderRun } from './render/html.js';

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

  override _transform(
    envelope: Envelope,
    _encoding: BufferEncoding,
    callback: TransformCallback,
  ): void {
    this.envelopes.push(envelope);
    callback();
  }

  override _flush(callback: TransformCallback): void {
    Promise.resolve()
      .then(() => renderRun(buildLoadedRun(this.envelopes), this.options))
      .then(
        (html) => callback(null, html),
        (error: unknown) =>
          callback(error instanceof Error ? error : new Error(String(error))),
      );
  }
}
