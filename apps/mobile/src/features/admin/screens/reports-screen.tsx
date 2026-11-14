import {
  type Bi,
  cairoToday,
  CATEGORIES,
  CATEGORY_LABEL,
  type Category,
  fmtCell,
  fmtDate,
  fmtNum,
  fmtPct,
  REPORT_GROUP_LABEL,
  REPORT_GROUPS,
  REPORT_PRESET_LABEL,
  REPORT_PRESETS,
  type ReportChart,
  type ReportId,
  type ReportKpi,
  type ReportLink,
  type ReportPreset,
  reportPresetRange,
  type ReportResult,
  REPORTS,
  reportSpec,
  type ReportTable,
  tableFilters,
  type TableView,
  viewRows,
  weekdayName,
} from '@maqar/shared';
import { type Href, useRouter } from 'expo-router';
import { ArrowDownRight, ArrowUpRight, ChevronDown, FileBarChart, Search, Share2, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Sheet } from '@/components/sheet';
import { Txt } from '@/components/text';
import { toast } from '@/components/toast';
import { useLang, useT } from '@/core/i18n';
import { fonts, radius, useTheme } from '@/core/theme';
import { ListingsError } from '@/features/listings/components/list-states';
import { useAreas } from '@/features/listings/hooks/use-listings';
import { useAgents } from '../hooks/use-admin';
import { useReport } from '../hooks/use-people';
import { shareCsv } from '../report-csv';
import { BackBar } from './clients-screen';

/** Rows shown per table before "Show all": a phone list stays quick to scroll. */
const PAGE = 25;

/** `/admin/reports` (phase 27): every standard report, by group. */
export function ReportsScreen() {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <BackBar fallback="/admin/more" />
      <ScrollView contentContainerStyle={styles.content}>
        <Txt accessibilityRole="header" size={24} weight="semibold">
          {t('التقارير', 'Reports')}
        </Txt>
        {REPORT_GROUPS.map((g) => (
          <View key={g} style={styles.group}>
            <Txt size={13} weight="semibold" color="ink3">
              {t(REPORT_GROUP_LABEL[g])}
            </Txt>
            {REPORTS.filter((r) => r.group === g && !r.needsAgent).map((r) => (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                accessibilityLabel={t(r.title)}
                accessibilityHint={t(r.description)}
                onPress={() => router.push(`/admin/report/${r.id}`)}
                style={({ pressed }) => [styles.card, styles.row, { backgroundColor: colors.surface, borderColor: colors.line, opacity: pressed ? 0.85 : 1 }]}
              >
                <FileBarChart size={20} color={colors.accentInk} />
                <View style={styles.flex}>
                  <Txt weight="semibold">{t(r.title)}</Txt>
                  <Txt size={12} color="ink2">
                    {t(r.description)}
                  </Txt>
                </View>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

type Filters = { agentId?: number; areaId?: string; category?: Category };

/**
 * `/admin/report/:id`: one report with its range, filters, totals, charts and tables. One advisor's
 * own report (phase 29) opens with `agentId`, from their row in the advisors report.
 */
export function ReportScreen({ id, agentId }: { id: ReportId; agentId?: number }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const spec = reportSpec(id);
  const today = cairoToday();
  const [preset, setPreset] = useState<ReportPreset>('30d');
  const [f, setF] = useState<Filters>(spec.needsAgent ? { agentId } : {});
  const range = reportPresetRange(preset, today);
  const agents = useAgents();
  const advisor = spec.needsAgent ? agents.data?.find((a) => a.id === f.agentId) : undefined;
  const report = useReport(id, { ...(spec.ranged ? range : {}), ...f }, !spec.needsAgent || f.agentId !== undefined);
  const r = report.data;

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <BackBar fallback="/admin/reports" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={report.isRefetching && !report.isPlaceholderData} onRefresh={() => void report.refetch()} tintColor={colors.accent} />}
      >
        <View style={styles.head}>
          <Txt accessibilityRole="header" size={22} weight="semibold">
            {advisor ? (lang === 'ar' ? advisor.nameAr : advisor.nameEn) : t(spec.title)}
          </Txt>
          <Txt size={13} color="ink2">
            {t(spec.description)}
          </Txt>
        </View>
        {spec.ranged ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {REPORT_PRESETS.map((p) => (
              <Pressable
                key={p}
                accessibilityRole="radio"
                accessibilityLabel={t(REPORT_PRESET_LABEL[p])}
                accessibilityState={{ checked: preset === p }}
                onPress={() => setPreset(p)}
                style={[styles.chip, { backgroundColor: preset === p ? colors.ink : colors.surface, borderColor: colors.line }]}
              >
                <Txt size={13} weight="medium" style={{ color: preset === p ? colors.bg : colors.ink }}>
                  {t(REPORT_PRESET_LABEL[p])}
                </Txt>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <Txt size={12} color="ink2">
            {t('صورة للوضع دلوقتي، من غير مدة.', 'A snapshot of now, with no range.')}
          </Txt>
        )}
        <FilterBar id={id} f={f} setF={setF} />
        {r?.range ? (
          <Txt size={12} color="ink3">
            {t(
              `${fmtCell(r.range.from, 'date', 'ar')} – ${fmtCell(r.range.to, 'date', 'ar')} | مقارنة بـ ${fmtCell(r.previous!.from, 'date', 'ar')} – ${fmtCell(r.previous!.to, 'date', 'ar')}`,
              `${fmtCell(r.range.from, 'date', 'en')} – ${fmtCell(r.range.to, 'date', 'en')} | compared with ${fmtCell(r.previous!.from, 'date', 'en')} – ${fmtCell(r.previous!.to, 'date', 'en')}`,
            )}
          </Txt>
        ) : null}
        {spec.needsAgent && f.agentId === undefined ? (
          <Txt size={13} color="ink2">
            {t('اختار المسؤول من فوق.', 'Pick the advisor above.')}
          </Txt>
        ) : report.isPending ? (
          <ActivityIndicator color={colors.accent} style={styles.loading} />
        ) : report.isError || !r ? (
          <ListingsError onRetry={() => void report.refetch()} />
        ) : (
          <View style={[styles.body, report.isFetching && styles.dim]}>
            <View style={styles.grid}>
              {r.kpis.map((k) => (
                <Kpi key={k.key} k={k} />
              ))}
            </View>
            {r.charts.map((c) => (
              <Chart key={c.key} c={c} />
            ))}
            {r.tables.map((tb) => (
              <Table key={tb.key} r={r} table={tb} />
            ))}
            {r.notes.map((n) => (
              <Txt key={n.en} size={12} color="ink3">
                {`• ${t(n)}`}
              </Txt>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/** The filters this report takes, each a pill that opens a list. */
function FilterBar({ id, f, setF }: { id: ReportId; f: Filters; setF: (f: Filters) => void }) {
  const t = useT();
  const lang = useLang();
  const spec = reportSpec(id);
  const agents = useAgents();
  const areas = useAreas();
  const [open, setOpen] = useState<'agent' | 'area' | 'category' | null>(null);
  const shown: ('agent' | 'area' | 'category')[] = spec.needsAgent ? ['agent'] : spec.filters;
  if (!shown.length) return null;
  const all = t('الكل', 'All');
  const name = (x: { nameAr: string; nameEn: string }) => (lang === 'ar' ? x.nameAr : x.nameEn);
  const lists: Record<'agent' | 'area' | 'category', { label: string; options: { key: string; label: string }[]; value: string | undefined; set: (v?: string) => void }> = {
    agent: {
      label: t('المسؤول', 'Advisor'),
      options: (agents.data ?? []).map((a) => ({ key: String(a.id), label: name(a) })),
      value: f.agentId === undefined ? undefined : String(f.agentId),
      set: (v) => setF({ ...f, agentId: v ? Number(v) : undefined }),
    },
    area: { label: t('المنطقة', 'Area'), options: (areas.data ?? []).map((a) => ({ key: a.id, label: name(a) })), value: f.areaId, set: (v) => setF({ ...f, areaId: v }) },
    category: {
      label: t('الغرض', 'Purpose'),
      options: CATEGORIES.map((c) => ({ key: c, label: t(CATEGORY_LABEL[c]) })),
      value: f.category,
      set: (v) => setF({ ...f, category: v as Category | undefined }),
    },
  };
  const current = open ? lists[open] : null;
  return (
    <>
      <View style={styles.chips}>
        {shown.map((k) => {
          const l = lists[k];
          const picked = l.options.find((o) => o.key === l.value)?.label;
          return <Pill key={k} label={`${l.label}: ${picked ?? (spec.needsAgent ? t('اختار', 'Pick one') : all)}`} on={!!picked} onPress={() => setOpen(k)} />;
        })}
      </View>
      <Sheet open={current !== null} onClose={() => setOpen(null)} title={current?.label ?? ''} scroll>
        {current
          ? [...(spec.needsAgent ? [] : [{ key: '', label: all }]), ...current.options].map((o) => (
              <Option
                key={o.key || 'all'}
                label={o.label}
                on={(current.value ?? '') === o.key}
                onPress={() => {
                  current.set(o.key || undefined);
                  setOpen(null);
                }}
              />
            ))
          : null}
      </Sheet>
    </>
  );
}

function Pill({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.pill, { backgroundColor: on ? colors.accentSoft : colors.surface, borderColor: colors.line }]}>
      <Txt size={12} weight="medium" color={on ? 'accentInk' : 'ink'}>
        {label}
      </Txt>
      <ChevronDown size={14} color={on ? colors.accentInk : colors.ink2} />
    </Pressable>
  );
}

function Option({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={label} onPress={onPress} style={[styles.option, { borderBottomColor: colors.line }]}>
      <Txt weight={on ? 'semibold' : 'regular'} color={on ? 'accentInk' : 'ink'}>
        {label}
      </Txt>
    </Pressable>
  );
}

function Kpi({ k }: { k: ReportKpi }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const moved = k.previous !== undefined && k.previous !== null && k.value !== null ? k.value - k.previous : null;
  const good = moved === null || moved === 0 || !k.better ? null : (moved > 0) === (k.better === 'up');
  const Arrow = moved !== null && moved > 0 ? ArrowUpRight : ArrowDownRight;
  const change = moved !== null && k.previous ? fmtPct((moved / Math.abs(k.previous)) * 100, lang, 0) : null;
  const before = k.previous !== undefined ? t(`قبلها: ${fmtCell(k.previous ?? null, k.format, 'ar')}`, `Before: ${fmtCell(k.previous ?? null, k.format, 'en')}`) + (change ? ` (${change})` : '') : null;
  const tone = good === null ? colors.ink3 : good ? colors.sage : colors.danger;
  return (
    <View
      accessible
      accessibilityLabel={`${t(k.label)}: ${fmtCell(k.value, k.format, lang)}${before ? `، ${before}` : ''}`}
      style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.line }]}
    >
      <Txt size={12} color="ink2">
        {t(k.label)}
      </Txt>
      <Txt size={20} weight="semibold">
        {fmtCell(k.value, k.format, lang)}
      </Txt>
      {before ? (
        <View style={styles.line}>
          {moved ? <Arrow size={12} color={tone} /> : null}
          <Txt size={11} style={{ color: tone }}>
            {before}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

function Chart({ c }: { c: ReportChart }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const [picked, setPicked] = useState<string | null>(null);
  if (c.kind === 'daily') {
    const top = Math.max(1, ...c.points.map((p) => p.value));
    const shown = c.points.find((p) => p.date === picked);
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <Txt weight="semibold">{t(c.title)}</Txt>
        <Txt size={12} color="ink2">
          {shown ? `${fmtDate(shown.date, lang)}: ${fmtCell(shown.value, c.format, lang)}` : t('دوس على يوم', 'Tap a day')}
        </Txt>
        <View style={[styles.bars, { borderBottomColor: colors.line2, gap: c.points.length > 31 ? 1 : 2 }]}>
          {c.points.map((p) => (
            <Pressable
              key={p.date}
              accessibilityRole="button"
              accessibilityLabel={`${fmtDate(p.date, lang)}: ${fmtCell(p.value, c.format, lang)}`}
              onPress={() => setPicked(p.date === picked ? null : p.date)}
              style={styles.barSlot}
            >
              <View style={[styles.bar, { height: p.value ? `${Math.max(2, (p.value / top) * 100)}%` : 0, backgroundColor: p.date === picked ? colors.accentInk : colors.accent }]} />
            </Pressable>
          ))}
        </View>
      </View>
    );
  }
  if (c.kind === 'bars') {
    const top = Math.max(1e-9, ...c.bars.map((b) => b.value));
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <Txt weight="semibold">{t(c.title)}</Txt>
        {c.bars.length ? (
          c.bars.map((b) => (
            <View key={b.label.en} accessible accessibilityLabel={`${t(b.label)}: ${fmtCell(b.value, c.format, lang)}`} style={styles.hbar}>
              <View style={styles.line}>
                <Txt size={13} style={styles.flex} numberOfLines={1}>
                  {t(b.label)}
                </Txt>
                <Txt size={13} weight="semibold">
                  {fmtCell(b.value, c.format, lang)}
                </Txt>
              </View>
              <View style={[styles.track, { backgroundColor: colors.surface2 }]}>
                <View style={[styles.fillBar, { width: `${(b.value / top) * 100}%`, backgroundColor: b.colour ?? colors.accent }]} />
              </View>
            </View>
          ))
        ) : (
          <Txt size={12} color="ink3">
            {t('مفيش حاجة في المدة دي', 'Nothing in this range')}
          </Txt>
        )}
      </View>
    );
  }
  const top = Math.max(1, ...c.values.flat());
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <Txt weight="semibold">{t(c.title)}</Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.heat}>
          <View style={styles.heatRow}>
            <View style={styles.heatDay} />
            {c.hours.map((h) => (
              <Txt key={h} size={10} color="ink3" align="center" style={styles.heatCell}>
                {fmtNum(h, lang)}
              </Txt>
            ))}
          </View>
          {c.weekdays.map((d, i) => (
            <View key={d} style={styles.heatRow}>
              <Txt size={11} color="ink2" style={styles.heatDay}>
                {weekdayName(d, lang)}
              </Txt>
              {c.values[i]!.map((v, j) => (
                <View
                  key={c.hours[j]}
                  accessible
                  accessibilityLabel={`${weekdayName(d, lang)} ${fmtNum(c.hours[j]!, lang)}: ${fmtNum(v, lang)}`}
                  style={[styles.heatCell, styles.heatBox, { backgroundColor: v ? colors.accent : colors.surface2, opacity: v ? 0.25 + (v / top) * 0.75 : 1 }]}
                >
                  {v ? (
                    <Txt size={10} weight="medium" style={{ color: colors.navy }}>
                      {fmtNum(v, lang)}
                    </Txt>
                  ) : null}
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const hrefOf = (l: ReportLink): Href => ({ listing: `/admin/listing/${l.id}`, agent: `/admin/agent/${l.id}`, client: `/admin/client/${l.id}`, chat: `/admin/chat/${l.id}` })[l.kind] as Href;

/**
 * A table as cards: the first column is the card's title (a link where it leads somewhere), the
 * rest are label and value. Above it: a search box, a filter for each column whose values repeat,
 * and the order (phase 29).
 */
function Table({ r, table }: { r: ReportResult; table: ReportTable }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { colors } = useTheme();
  const [all, setAll] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [view, setView] = useState<TableView>({});
  const [open, setOpen] = useState<string | null>(null);
  const filters = useMemo(() => tableFilters(table), [table]);
  const found = useMemo(() => viewRows(table, view, lang), [table, view, lang]);
  const [first, ...rest] = table.columns;
  const rows = all ? found : found.slice(0, PAGE);
  const narrowed = found.length !== table.rows.length;
  const any = t('الكل', 'All');
  // In the advisors report a row opens that advisor's own report.
  const linkOf = (l: ReportLink): Href => (r.id === 'advisors' && l.kind === 'agent' ? (`/admin/report/advisor?agentId=${l.id}` as Href) : hrefOf(l));
  const share = async () => {
    setSharing(true);
    try {
      await shareCsv(r, { ...table, rows: found }, lang);
    } catch {
      toast.show({ title: t('مقدرناش نجهز الملف', 'We couldn’t make the file'), tone: 'danger' });
    } finally {
      setSharing(false);
    }
  };

  // Sorting: numbers and dates start from the biggest or latest, text from A.
  const numeric = (f: string) => f !== 'text' && f !== 'date';
  const sortName = (col: (typeof table.columns)[number], up: boolean) =>
    col.format === 'text'
      ? up
        ? t('من الأول للآخر', 'A to Z')
        : t('من الآخر للأول', 'Z to A')
      : col.format === 'date'
        ? up
          ? t('الأقدم الأول', 'oldest first')
          : t('الأحدث الأول', 'newest first')
        : up
          ? t('الأصغر الأول', 'smallest first')
          : t('الأكبر الأول', 'biggest first');
  const sortOptions = table.columns.flatMap((col) => (numeric(col.format) || col.format === 'date' ? [false, true] : [true, false]).map((up) => ({ col, up })));
  const sortCol = view.sort ? table.columns.find((c) => c.key === view.sort!.key) : undefined;
  const sortLabel = `${t('الترتيب', 'Order')}: ${sortCol ? `${t(sortCol.label)}${t('،', ',')} ${sortName(sortCol, view.sort!.up)}` : t('زي ما هو', 'as it is')}`;
  const filter = filters.find((f) => f.key === open);

  return (
    <View style={styles.tableBlock}>
      <View style={styles.line}>
        <Txt weight="semibold" style={styles.flex}>
          {`${t(table.title)} (${narrowed ? t(`${fmtNum(found.length, 'ar')} من ${fmtNum(table.rows.length, 'ar')}`, `${found.length} of ${table.rows.length}`) : fmtNum(table.rows.length, lang)})`}
        </Txt>
        {found.length ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t(`شارك ${t(table.title)} كملف CSV`, `Share ${table.title.en} as CSV`)} disabled={sharing} onPress={() => void share()} style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            {sharing ? <ActivityIndicator size="small" color={colors.accent} /> : <Share2 size={14} color={colors.ink} />}
            <Txt size={12} weight="medium">
              CSV
            </Txt>
          </Pressable>
        ) : null}
      </View>
      {table.rows.length > 1 ? (
        <>
          <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Search size={16} color={colors.ink3} />
            <TextInput
              accessibilityLabel={t(`ابحث في ${table.title.ar}`, `Search ${table.title.en}`)}
              value={view.q ?? ''}
              onChangeText={(q) => setView((v) => ({ ...v, q }))}
              placeholder={t('ابحث في الجدول', 'Search this table')}
              placeholderTextColor={colors.ink3}
              autoCorrect={false}
              autoCapitalize="none"
              style={[styles.input, { color: colors.ink }]}
            />
            {view.q ? (
              <Pressable accessibilityRole="button" accessibilityLabel={t('امسح البحث', 'Clear search')} onPress={() => setView((v) => ({ ...v, q: '' }))} hitSlop={8}>
                <X size={16} color={colors.ink3} />
              </Pressable>
            ) : null}
          </View>
          <View style={styles.chips}>
            {filters.map((f) => {
              const picked = f.options.find((o) => o.value === view.filters?.[f.key]);
              return <Pill key={f.key} label={`${t(f.label)}: ${picked ? t(picked.label) : any}`} on={!!picked} onPress={() => setOpen(f.key)} />;
            })}
            <Pill label={sortLabel} on={!!view.sort} onPress={() => setOpen('sort')} />
          </View>
        </>
      ) : null}
      {!found.length ? (
        <Txt size={12} color="ink3">
          {table.rows.length ? t('مفيش حاجة مطابقة للبحث والفلاتر', 'Nothing matches the search and filters') : t('مفيش حاجة هنا', 'Nothing here')}
        </Txt>
      ) : null}
      {rows.map((row, i) => {
        const title = fmtCell(row.cells[first!.key] ?? null, first!.format, lang);
        const body = (
          <>
            <Txt weight="semibold" color={row.link ? 'accentInk' : 'ink'}>
              {title}
            </Txt>
            <View style={styles.cells}>
              {rest.map((col) => (
                <View key={col.key} style={styles.cell}>
                  <Txt size={11} color="ink3">
                    {t(col.label as Bi)}
                  </Txt>
                  <Txt size={13} weight="medium">
                    {fmtCell(row.cells[col.key] ?? null, col.format, lang)}
                  </Txt>
                </View>
              ))}
            </View>
          </>
        );
        const style = [styles.card, { backgroundColor: colors.surface, borderColor: colors.line }];
        return row.link ? (
          <Pressable key={`${row.link.kind}-${row.link.id}-${i}`} testID="report-row" accessibilityRole="link" accessibilityLabel={title} onPress={() => router.push(linkOf(row.link!))} style={style}>
            {body}
          </Pressable>
        ) : (
          <View key={i} testID="report-row" style={style}>
            {body}
          </View>
        );
      })}
      {!all && found.length > PAGE ? (
        <Pressable accessibilityRole="button" onPress={() => setAll(true)} style={[styles.more, { borderColor: colors.line }]}>
          <Txt size={13} weight="medium" color="accentInk">
            {t(`اعرض الكل (${fmtNum(found.length, 'ar')})`, `Show all (${found.length})`)}
          </Txt>
        </Pressable>
      ) : null}
      {table.note ? (
        <Txt size={12} color="ink3">
          {t(table.note)}
        </Txt>
      ) : null}
      <Sheet open={open !== null} onClose={() => setOpen(null)} title={open === 'sort' ? t('الترتيب', 'Order') : filter ? t(filter.label) : ''} scroll>
        {open === 'sort' ? (
          <>
            <Option
              label={t('زي ما هو', 'As it is')}
              on={!view.sort}
              onPress={() => {
                setView((v) => ({ ...v, sort: null }));
                setOpen(null);
              }}
            />
            {sortOptions.map(({ col, up }) => (
              <Option
                key={`${col.key}-${up}`}
                label={`${t(col.label)}: ${sortName(col, up)}`}
                on={view.sort?.key === col.key && view.sort.up === up}
                onPress={() => {
                  setView((v) => ({ ...v, sort: { key: col.key, up } }));
                  setOpen(null);
                }}
              />
            ))}
          </>
        ) : filter ? (
          [{ value: '', label: { ar: any, en: any } }, ...filter.options].map((o) => (
            <Option
              key={o.value || 'all'}
              label={t(o.label)}
              on={(view.filters?.[filter.key] ?? '') === o.value}
              onPress={() => {
                setView((v) => ({ ...v, filters: { ...v.filters, [filter.key]: o.value } }));
                setOpen(null);
              }}
            />
          ))
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 14 },
  group: { gap: 8 },
  head: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  loading: { marginTop: 40 },
  body: { gap: 14 },
  dim: { opacity: 0.6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 36, borderRadius: radius.full, borderWidth: 1, paddingHorizontal: 14, justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, borderRadius: radius.full, borderWidth: 1, paddingHorizontal: 12 },
  option: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48%', flexGrow: 1, borderRadius: radius.lg, borderWidth: 1, padding: 12, gap: 2 },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: 14, gap: 8 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 110, borderBottomWidth: 1 },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  hbar: { gap: 4 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fillBar: { height: '100%', borderRadius: 4 },
  heat: { gap: 3 },
  heatRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  heatDay: { width: 58 },
  heatCell: { width: 26 },
  heatBox: { height: 26, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  tableBlock: { gap: 8 },
  cells: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8, columnGap: 16 },
  cell: { minWidth: '40%', flexGrow: 1, flexBasis: '40%' },
  more: { borderWidth: 1, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 42, borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: 12 },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 14, paddingVertical: 0 },
});
