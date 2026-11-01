import { SettingEditor, SpecialtiesEditor } from "@/components/admin/settings-editor";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { adminPage, formatDateTime } from "@/lib/admin/server";
import { isSettingKey, type SettingKey } from "@/lib/admin/settings-schemas";

export const metadata = { title: "Баптаулар" };
export const dynamic = "force-dynamic";

const ORDER = ["unt_structure", "diagnostic", "xp", "levels", "league", "ai_limits"];

export default async function AdminSettingsPage() {
  const db = await adminPage();
  const [settings, specialties] = db
    ? await Promise.all([
        db.from("app_settings").select("key, value, description, updated_at"),
        db.from("specialties").select("id, code, name_kk, name_ru, subject_pair, threshold_score, year, is_active").order("year", { ascending: false }).order("code"),
      ]).then(([s, sp]) => [s.data ?? [], sp.data ?? []] as const)
    : ([[], []] as const);

  const sorted = [...settings].filter((s) => isSettingKey(s.key)).sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key));

  return (
    <>
      <AdminHeader
        title="Баптаулар"
        description="ҰБТ құрылымы, XP, деңгейлер, лига, AI лимиттері (JSON) және мамандықтардың шекті балдары. Сақтамас бұрын әр мән тексеріледі."
      />
      <div className="space-y-5">
        <Panel title="Мамандықтар және шекті грант балдары">
          <SpecialtiesEditor rows={[...specialties]} year={new Date().getFullYear()} />
        </Panel>
        <Panel title="Платформа параметрлері">
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">Баптаулар жоқ — миграциялар іске қосылмаған.</p>
          ) : (
            <div className="space-y-8">
              {sorted.map((s) => (
                <SettingEditor
                  key={s.key}
                  settingKey={s.key as SettingKey}
                  value={JSON.stringify(s.value, null, 2)}
                  description={s.description}
                  updatedAt={formatDateTime(s.updated_at)}
                />
              ))}
            </div>
          )}
          <p className="mt-6 text-xs text-muted-foreground">
            Ескерту: ҰБТ құрылымы өзгерсе, бұрын құрастырылған варианттар ескі құрылымын сақтайды — жаңа құрылыммен жаңа вариант құрастырыңыз.
          </p>
        </Panel>
      </div>
    </>
  );
}
