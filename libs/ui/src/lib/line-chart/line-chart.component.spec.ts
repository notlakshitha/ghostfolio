import { LineChartItem } from '@ghostfolio/common/interfaces';

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Chart, type Point } from 'chart.js';
import { parseISO } from 'date-fns';

import { GfLineChartComponent } from './line-chart.component';

describe('GfLineChartComponent', () => {
  let fixture: ComponentFixture<GfLineChartComponent>;
  let component: GfLineChartComponent;
  const originalAnimation = Chart.defaults.animation;

  beforeAll(() => {
    Chart.defaults.animation = false;
    class ResizeObserverStub {
      public disconnect() {
        return undefined;
      }

      public observe() {
        return undefined;
      }

      public unobserve() {
        return undefined;
      }
    }

    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      value: ResizeObserverStub,
      writable: true
    });

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => {
        return {
          addEventListener: () => undefined,
          matches: false,
          media: query,
          removeEventListener: () => undefined
        };
      },
      writable: true
    });

    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      contextId: string
    ) {
      if (contextId !== '2d') {
        return null;
      }

      const context = createCanvasContext();
      context.canvas = this;

      return context as unknown as CanvasRenderingContext2D;
    } as typeof HTMLCanvasElement.prototype.getContext;
  });

  afterAll(() => {
    Chart.defaults.animation = originalAnimation;
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GfLineChartComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(GfLineChartComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    component.chart?.destroy();
    fixture.destroy();
  });

  it('keeps every point when data decimation is disabled', async () => {
    const historicalDataItems = createHistoricalDataItems(20);

    fixture.componentRef.setInput('historicalDataItems', historicalDataItems);
    fixture.componentRef.setInput('dataDecimation', false);
    fixture.detectChanges();
    stubChartSize(fixture.nativeElement as HTMLElement);
    await flushChartInitialization();

    const marketPrices = component.chart?.data.datasets[1].data;

    expect(component.chart?.ctx).toBeTruthy();
    expect(component.chart?.options.parsing).not.toBe(false);
    expect(component.chart?.options.plugins?.decimation?.enabled).toBe(false);
    expect(marketPrices).toEqual(
      historicalDataItems.map(({ value }) => {
        return value;
      })
    );
  });

  it('decimates dense series with the Chart.js plugin defaults', async () => {
    const historicalDataItems = createHistoricalDataItems(2000);
    const benchmarkDataItems = historicalDataItems.map(
      ({ date, value }, index) => {
        return {
          date,
          value: index % 25 === 0 ? null : value / 2
        };
      }
    );

    fixture.componentRef.setInput('benchmarkDataItems', benchmarkDataItems);
    fixture.componentRef.setInput('dataDecimation', true);
    fixture.componentRef.setInput('historicalDataItems', historicalDataItems);
    fixture.componentRef.setInput('showXAxis', true);
    fixture.componentRef.setInput('showYAxis', true);
    fixture.detectChanges();
    stubChartSize(fixture.nativeElement as HTMLElement);
    await flushChartInitialization();

    const marketPrices = component.chart?.data.datasets[1].data ?? [];
    const benchmarkPrices = component.chart?.data.datasets[0].data ?? [];
    const decimation = component.chart?.options.plugins?.decimation;

    expect(component.chart?.ctx).toBeTruthy();
    expect(component.chart?.options.parsing).toBe(false);
    expect(decimation?.enabled).toBe(true);
    expect(decimation?.algorithm ?? 'min-max').toBe('min-max');
    expect(decimation?.threshold).toBeUndefined();
    expect(marketPrices.length).toBeGreaterThan(1);
    expect(marketPrices.length).toBeLessThan(historicalDataItems.length);
    expect(benchmarkPrices.length).toBeGreaterThan(1);
    expect(benchmarkPrices.length).toBeLessThan(benchmarkDataItems.length);
    expect(isPoint(marketPrices[0])).toBe(true);

    if (isPoint(marketPrices[0])) {
      expect(marketPrices[0].x).toBe(
        parseISO(historicalDataItems[0].date).getTime()
      );
      expect(marketPrices[0].y).toBe(historicalDataItems[0].value);
    }
  });

  it('registers the decimation plugin', () => {
    expect(Chart.registry.plugins.get('decimation')).toBeDefined();
  });
});

function createHistoricalDataItems(count: number): LineChartItem[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(2010, 0, 1 + index));

    return {
      date: date.toISOString().slice(0, 10),
      value: Math.sin(index / 8) * 50 + index / 20
    };
  });
}

function isPoint(
  value: number | Point | { x: number; y: number | null } | null | undefined
): value is { x: number; y: number | null } {
  return typeof value === 'object' && value !== null && 'x' in value;
}

function stubChartSize(host: HTMLElement) {
  host.getBoundingClientRect = () => {
    return {
      bottom: 112,
      height: 112,
      left: 0,
      right: 200,
      top: 0,
      width: 200,
      x: 0,
      y: 0,
      toJSON: () => {
        return {};
      }
    };
  };
}

async function flushChartInitialization() {
  await new Promise((resolve) => {
    setTimeout(resolve);
  });
}

function createCanvasContext() {
  const context: Record<string | symbol, unknown> = {
    beginPath: () => undefined,
    bezierCurveTo: () => undefined,
    canvas: undefined,
    clearRect: () => undefined,
    clip: () => undefined,
    closePath: () => undefined,
    createLinearGradient: () => {
      return {
        addColorStop: () => undefined
      };
    },
    fill: () => undefined,
    fillRect: () => undefined,
    fillText: () => undefined,
    getTransform: () => {
      return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    },
    lineTo: () => undefined,
    measureText: () => {
      return { width: 0 };
    },
    moveTo: () => undefined,
    quadraticCurveTo: () => undefined,
    rect: () => undefined,
    restore: () => undefined,
    save: () => undefined,
    scale: () => undefined,
    setLineDash: () => undefined,
    setTransform: () => undefined,
    stroke: () => undefined,
    strokeRect: () => undefined,
    transform: () => undefined,
    translate: () => undefined
  };

  return new Proxy(context, {
    get(target, property) {
      if (Reflect.has(target, property)) {
        return target[property];
      }

      return () => undefined;
    },
    set(target, property, value) {
      target[property] = value;
      return true;
    }
  });
}
