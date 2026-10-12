import {
  getChartBorderColor,
  getTimeAxisOptions,
  getValueAxisOptions,
  getVerticalHoverLinePlugin
} from '@ghostfolio/common/chart-helper';
import { primaryColorRgb, secondaryColorRgb } from '@ghostfolio/common/config';
import { getBackgroundColor, getLocale } from '@ghostfolio/common/helper';
import {
  LineChartItem,
  NullableLineChartItem
} from '@ghostfolio/common/interfaces';
import { ColorScheme } from '@ghostfolio/common/types';

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  type ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import {
  type AnimationsSpec,
  Chart,
  type ChartData,
  type ChartOptions,
  Decimation,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  TimeScale,
  Tooltip,
  type TooltipOptions
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { parseISO } from 'date-fns';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';

import {
  getTimeSeriesTooltipOptions,
  onPrefersColorSchemeChange,
  registerChartConfiguration
} from '../chart';

type LineChartDatasetPoint = number | { x: number; y: number | null } | null;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgxSkeletonLoaderModule],
  selector: 'gf-line-chart',
  styleUrls: ['./line-chart.component.scss'],
  templateUrl: './line-chart.component.html'
})
export class GfLineChartComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @Input() benchmarkDataItems: NullableLineChartItem[] = [];
  @Input() benchmarkLabel = '';
  @Input() colorScheme?: ColorScheme;
  @Input() currency?: string;
  @Input() dataDecimation = false;
  @Input() historicalDataItems: LineChartItem[] | null;
  @Input() isAnimated = false;
  @Input() label: string;
  @Input() locale = getLocale();
  @Input() showGradient = false;
  @Input() showLegend = false;
  @Input() showLoader = true;
  @Input() showXAxis = false;
  @Input() showYAxis = false;
  @Input() unit: string;
  @Input() yMax: number;
  @Input() yMaxLabel: string;
  @Input() yMin: number;
  @Input() yMinLabel: string;

  @ViewChild('chartCanvas') chartCanvas: ElementRef<HTMLCanvasElement>;

  public chart?: Chart<'line', LineChartDatasetPoint[], string>;
  public isLoading = true;

  private readonly ANIMATION_DURATION = 1200;

  public constructor(private changeDetectorRef: ChangeDetectorRef) {
    Chart.register(
      Decimation,
      Filler,
      LineController,
      LineElement,
      PointElement,
      LinearScale,
      TimeScale,
      Tooltip
    );

    registerChartConfiguration();

    onPrefersColorSchemeChange(() => {
      if (this.chart && !this.colorScheme) {
        this.chart.destroy();
        this.chart = undefined;

        this.initialize();
      }
    });
  }

  public ngAfterViewInit() {
    if (this.historicalDataItems) {
      setTimeout(() => {
        // Wait for the chartCanvas
        this.initialize();

        this.changeDetectorRef.markForCheck();
      });
    }
  }

  public ngOnChanges(changes: SimpleChanges) {
    if (changes.colorScheme && this.chart) {
      this.chart.destroy();
      this.chart = undefined;
    }

    if (this.historicalDataItems || this.historicalDataItems === null) {
      setTimeout(() => {
        // Wait for the chartCanvas
        this.initialize();

        this.changeDetectorRef.markForCheck();
      });
    }
  }

  public ngOnDestroy() {
    this.chart?.destroy();
  }

  private initialize() {
    this.isLoading = true;
    const benchmarkPrices: LineChartDatasetPoint[] = [];
    const labels: string[] = [];
    const marketPrices: LineChartDatasetPoint[] = [];

    this.historicalDataItems?.forEach((historicalDataItem, index) => {
      benchmarkPrices.push(
        this.toDatasetPoint(
          historicalDataItem.date,
          this.benchmarkDataItems?.[index]?.value ?? null
        )
      );
      labels.push(historicalDataItem.date);
      marketPrices.push(
        this.toDatasetPoint(historicalDataItem.date, historicalDataItem.value)
      );
    });

    const gradient = this.chartCanvas?.nativeElement
      ?.getContext('2d')
      ?.createLinearGradient(
        0,
        0,
        0,
        ((this.chartCanvas.nativeElement.parentNode as HTMLElement)
          .offsetHeight *
          4) /
          5
      );

    if (gradient && this.showGradient) {
      gradient.addColorStop(
        0,
        `rgba(${primaryColorRgb.r}, ${primaryColorRgb.g}, ${primaryColorRgb.b}, 0.01)`
      );
      gradient.addColorStop(1, getBackgroundColor(this.colorScheme));
    }

    const data: ChartData<'line', LineChartDatasetPoint[], string> = {
      // Decimation replaces dataset.data, so category labels would no longer
      // line up with the rendered points. Positions come from each point's x.
      labels: this.dataDecimation ? undefined : labels,
      datasets: [
        {
          borderColor: `rgb(${secondaryColorRgb.r}, ${secondaryColorRgb.g}, ${secondaryColorRgb.b})`,
          borderWidth: 1,
          data: benchmarkPrices,
          fill: false,
          label: this.benchmarkLabel,
          pointRadius: 0,
          spanGaps: false
        },
        {
          backgroundColor: gradient,
          borderColor: `rgb(${primaryColorRgb.r}, ${primaryColorRgb.g}, ${primaryColorRgb.b})`,
          borderWidth: 2,
          data: marketPrices,
          fill: true,
          label: this.label,
          pointRadius: 0
        }
      ]
    };

    if (this.chartCanvas) {
      const animations = {
        x: this.getAnimationConfigurationForAxis({ labels, axis: 'x' }),
        y: this.getAnimationConfigurationForAxis({ labels, axis: 'y' })
      };

      if (this.chart) {
        this.chart.data = data;
        this.chart.options.plugins ??= {};
        this.chart.options.plugins.tooltip =
          this.getTooltipPluginConfiguration();
        this.chart.options.animations = this.isAnimated
          ? animations
          : undefined;
        this.configureDataDecimation(this.chart.options);

        this.chart.update();
      } else {
        const options: ChartOptions<'line'> = {
          animations: this.isAnimated ? animations : undefined,
          aspectRatio: 16 / 9,
          elements: {
            point: {
              hoverBackgroundColor: getBackgroundColor(this.colorScheme),
              hoverRadius: 2
            }
          },
          interaction: { intersect: false, mode: 'index' },
          plugins: {
            legend: {
              align: 'start',
              display: this.showLegend,
              position: 'bottom'
            },
            tooltip: this.getTooltipPluginConfiguration(),
            verticalHoverLine: {
              color: getChartBorderColor(this.colorScheme)
            }
          },
          scales: {
            x: getTimeAxisOptions({
              colorScheme: this.colorScheme,
              display: this.showXAxis,
              locale: this.locale
            }),
            y: {
              ...getValueAxisOptions({
                colorScheme: this.colorScheme,
                display: this.showYAxis,
                highlightedValues: [this.yMax, this.yMin],
                tickCallback: (tickValue, index, ticks) => {
                  if (index === 0 || index === ticks.length - 1) {
                    // Only print last and first legend entry

                    if (index === 0 && this.yMinLabel) {
                      return this.yMinLabel;
                    }

                    if (index === ticks.length - 1 && this.yMaxLabel) {
                      return this.yMaxLabel;
                    }

                    if (typeof tickValue === 'number') {
                      return tickValue.toLocaleString(this.locale, {
                        maximumFractionDigits: 2,
                        minimumFractionDigits: 2,
                        useGrouping: true
                      });
                    }

                    return tickValue;
                  }

                  return '';
                }
              }),
              max: this.yMax,
              min: this.yMin,
              type: 'linear'
            }
          },
          spanGaps: true
        };

        this.configureDataDecimation(options);

        this.chart = new Chart<'line', LineChartDatasetPoint[], string>(
          this.chartCanvas.nativeElement,
          {
            data,
            options,
            plugins: [
              getVerticalHoverLinePlugin(this.chartCanvas, this.colorScheme)
            ],
            type: 'line'
          }
        );
      }
    }

    this.isLoading = false;
  }

  private configureDataDecimation(options: ChartOptions<'line'>) {
    // The plugin skips the chart unless parsing is disabled. While it is
    // disabled, points must already be sorted {x, y} values. Plugin defaults
    // (min-max, threshold of four times the canvas width) stay in place.
    options.parsing = (
      this.dataDecimation ? false : true
    ) as ChartOptions<'line'>['parsing'];
    options.plugins ??= {};
    options.plugins.decimation = {
      enabled: this.dataDecimation
    };
  }

  private getAnimationConfigurationForAxis({
    axis,
    labels
  }: {
    axis: 'x' | 'y';
    labels: string[];
  }): Partial<AnimationsSpec<'line'>[string]> {
    const delayBetweenPoints = this.ANIMATION_DURATION / labels.length;

    return {
      delay(context) {
        if (context.type !== 'data' || context[`${axis}Started`]) {
          return 0;
        }

        context[`${axis}Started`] = true;
        return context.dataIndex * delayBetweenPoints;
      },
      duration: delayBetweenPoints,
      easing: 'linear',
      from: NaN,
      type: 'number'
    };
  }

  private toDatasetPoint(
    date: string,
    value: number | null
  ): LineChartDatasetPoint {
    if (!this.dataDecimation) {
      return value;
    }

    return {
      x: parseISO(date).getTime(),
      y: value
    };
  }

  private getTooltipPluginConfiguration(): Partial<TooltipOptions<'line'>> {
    return getTimeSeriesTooltipOptions<'line'>({
      colorScheme: this.colorScheme,
      currency: this.currency,
      locale: this.locale,
      unit: this.unit
    });
  }
}
