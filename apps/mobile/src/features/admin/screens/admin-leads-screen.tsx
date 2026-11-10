import { type AdminLeadItem, fmtNum, LEAD_STAGE_COLOUR, LEAD_STAGE_LABEL, relTime } from '@maqar/shared';
import { Check, Users } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sheet } from '@/components/sheet';
import { Txt } from '@/components/text';
import { toast } from '@/components/toast';
import { ApiError } from '@/core/api/api';
import { useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';
import { CardSkeleton, ListingsError } from '@/features/listings/components/list-states';
import { useAdminAgents, useAdminLeads, useAssignLead } from '../hooks/use-admin';

/** The admin's Leads tab (phase 18): every agent's leads, by agent; a lead can move to another agent. */
export function AdminLeadsScreen() {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [agentId, setAgentId] = useState<number | undefined>();
  const leads = useAdminLeads(agentId);
  const agents = useAdminAgents();
  const [moving, setMoving] = useState<AdminLeadItem | null>(null);
  const list = leads.data ?? [];

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <FlatList
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
        data={leads.isSuccess ? list : []}
        keyExtractor={(l) => String(l.id)}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        renderItem={({ item }) => <LeadRow lead={item} onPress={() => setMoving(item)} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Txt accessibilityRole="header" size={24} weight="semibold">
              {t('العملاء', 'Leads')}
            </Txt>
            <Txt size={13} color="ink2">
              {t('دوس على عميل علشان تنقله لمسؤول تاني.', 'Tap a lead to move it to another agent.')}
            </Txt>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.chips}>
              {[undefined, ...(agents.data ?? []).map((a) => a.id)].map((id) => {
                const a = agents.data?.find((x) => x.id === id);
                const on = agentId === id;
                const label = a ? (lang === 'ar' ? a.nameAr : a.nameEn) : t('كل المسؤولين', 'All agents');
                return (
                  <Pressable
                    key={id ?? 'all'}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={label}
                    onPress={() => setAgentId(id)}
                    style={[styles.chip, { backgroundColor: on ? colors.ink : colors.surface, borderColor: colors.line }]}
                  >
                    {a ? <View style={[styles.dot, { backgroundColor: a.colour }]} /> : null}
                    <Txt size={13} weight="medium" style={{ color: on ? colors.bg : colors.ink }}>
                      {label}
                    </Txt>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          leads.isPending ? (
            <CardSkeleton />
          ) : leads.isError ? (
            <ListingsError onRetry={() => void leads.refetch()} />
          ) : (
            <View style={styles.empty}>
              <Users size={32} color={colors.ink3} strokeWidth={1.6} />
              <Txt weight="medium">{t('مفيش عملاء هنا', 'No leads here')}</Txt>
            </View>
          )
        }
        refreshControl={<RefreshControl refreshing={leads.isRefetching} onRefresh={() => void leads.refetch()} tintColor={colors.accent} />}
      />
      <MoveSheet lead={moving} onClose={() => setMoving(null)} />
    </View>
  );
}

function LeadRow({ lead, onPress }: { lead: AdminLeadItem; onPress: () => void }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const agent = lang === 'ar' ? lead.agent.nameAr : lead.agent.nameEn;
  const home = lead.property ? (lang === 'ar' ? lead.property.titleAr : lead.property.titleEn) : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${lead.name || t('عميل', 'Client')}، ${agent}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: colors.surface, borderColor: colors.line, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={styles.flex}>
        <View style={styles.top}>
          <Txt weight="medium" numberOfLines={1} style={styles.flex}>
            {lead.name || t('عميل اتمسح حسابه', 'Deleted account')}
          </Txt>
          <View style={[styles.stage, { backgroundColor: `${LEAD_STAGE_COLOUR[lead.stage]}22` }]}>
            <Txt size={11} weight="semibold" style={{ color: LEAD_STAGE_COLOUR[lead.stage] }}>
              {t(LEAD_STAGE_LABEL[lead.stage])}
            </Txt>
          </View>
        </View>
        {home ? (
          <Txt size={12} color="ink2" numberOfLines={1}>
            {home}
          </Txt>
        ) : null}
        <View style={styles.top}>
          <View style={[styles.dot, { backgroundColor: lead.agent.colour }]} />
          <Txt size={12} color="ink3" style={styles.flex}>
            {`${agent} | ${relTime(new Date(lead.lastActivityAt), lang)}`}
          </Txt>
        </View>
      </View>
    </Pressable>
  );
}

function MoveSheet({ lead, onClose }: { lead: AdminLeadItem | null; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const agents = useAdminAgents(lead !== null);
  const assign = useAssignLead();
  const move = (agentId: number) =>
    assign.mutate(
      { id: lead!.id, agentId },
      {
        onSuccess: (l) => {
          toast.show({ title: t(`العميل اتنقل لـ ${l.agent.nameAr}`, `Moved to ${l.agent.nameEn}`), body: t('المسؤول الجديد وصله إشعار.', 'The new agent got a notification.'), tone: 'sage' });
          onClose();
        },
        onError: (e) =>
          toast.show({
            title: e instanceof ApiError && e.status === 409 ? t('العميل ده عنده ملف مع المسؤول ده بالفعل', 'This client already has a lead with that agent') : t('حصلت مشكلة، حاول تاني', 'Something went wrong, try again'),
            tone: 'danger',
          }),
      },
    );
  return (
    <Sheet open={lead !== null} onClose={onClose} title={t('انقل العميل لمسؤول تاني', 'Move the lead to another agent')} scroll>
      <Txt size={13} color="ink2">
        {t('الشات والمعاينات بيفضلوا مع مسؤول العقار.', 'Chats and viewings stay with the home’s advisor.')}
      </Txt>
      {agents.isPending ? <ActivityIndicator color={colors.accent} /> : null}
      {(agents.data ?? []).map((a) => {
        const current = a.id === lead?.agent.id;
        const name = lang === 'ar' ? a.nameAr : a.nameEn;
        return (
          <Pressable
            key={a.id}
            accessibilityRole="button"
            accessibilityLabel={name}
            accessibilityState={{ disabled: current || assign.isPending }}
            disabled={current || assign.isPending}
            onPress={() => move(a.id)}
            style={[styles.option, { backgroundColor: colors.surface, borderColor: current ? colors.accent : colors.line }]}
          >
            <View style={[styles.dot, { backgroundColor: a.colour }]} />
            <View style={styles.flex}>
              <Txt weight="medium">{name}</Txt>
              <Txt size={12} color="ink2">
                {t(`${fmtNum(a.live, 'ar')} عقار منشور`, `${a.live} live listings`)}
              </Txt>
            </View>
            {current ? <Check size={18} color={colors.accentInk} /> : null}
          </Pressable>
        );
      })}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  header: { gap: 10, marginBottom: 16 },
  gap: { height: 8 },
  bleed: { marginHorizontal: -16 },
  chips: { gap: 8, paddingHorizontal: 16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.full, borderWidth: 1, paddingHorizontal: 14, minHeight: 38 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  row: { padding: 12, borderRadius: radius.lg, borderWidth: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stage: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 48 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radius.md, borderWidth: 1, padding: 12 },
});
