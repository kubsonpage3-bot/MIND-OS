import re

with open("src/pages/Dashboard_new.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# Replace the TabErrorBoundary and AnimatePresence with the mapped BOTTOM_TABS
# First, let's find the start of <TabErrorBoundary tabKey={activeTab}>
tab_error_boundary_start = content.find("<TabErrorBoundary tabKey={activeTab}>")
# Find the end: </TabErrorBoundary>
tab_error_boundary_end = content.find(
    "</TabErrorBoundary>", tab_error_boundary_start
) + len("</TabErrorBoundary>")

if tab_error_boundary_start == -1 or tab_error_boundary_end == -1:
    print("Could not find TabErrorBoundary")
    exit(1)

# What goes inside TabErrorBoundary now?
new_carousel_logic = """<TabErrorBoundary tabKey={activeTab}>
            <div className="w-full h-full overflow-hidden relative">
              <motion.div
                className="flex flex-row w-full h-full"
                style={{ x: dragX, willChange: 'transform' }}
              >
                {BOTTOM_TABS.map((tabKey, idx) => {
                  if (Math.abs(idx - activeTabIndex) > 1) {
                    return <div key={tabKey} className="w-full shrink-0" />;
                  }

                  // If this tab is the active one, we might render a sub-section like 'train' or 'rival'
                  // instead of the base tabKey if activeSection is mapped here.
                  const sectionToRender = (idx === activeTabIndex) ? activeSection : tabKey;
                  const isTools = ["history", "pomodoro", "calendar", "stats"].includes(sectionToRender);

                  return (
                    <div key={tabKey} className="w-full shrink-0 h-full overflow-y-auto overflow-x-hidden touch-pan-y px-0 md:px-4">
                      
                      {/* Dashboard ?" Habitica-style layout */}
                      {sectionToRender === "dashboard" && (
                        <>
                          <TabGuideModal guideId="dashboard" profile={profile} />
                          {/* IQ + Metrics block */}
                          {profile && (
                            <div className="mb-4 rounded-none border-x-0 border-y md:border md:rounded-2xl overflow-hidden bg-[var(--habit-panel)] border-[var(--habit-border)] shadow-sm">
                              <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                                <span style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 13, letterSpacing: "0.06em", color: "var(--habit-text)" }}>{"?? " + t("dashboard.metrics", "COGNITIVE METRICS").toUpperCase()}</span>
                              </div>
                              <div className="px-4 pb-4">
                                <div className="flex flex-col md:flex-row gap-4">
                                  <div className="shrink-0">
                                    <IQDisplay gf={profile.gf} gc={profile.gc} ps={profile.ps} vm={profile.vm} gfCeiling={profile.gf_ceiling} gcCeiling={profile.gc_ceiling} psCeiling={profile.ps_ceiling} vmCeiling={profile.vm_ceiling} />
                                  </div>
                                  <div className="flex-1 space-y-3 py-2">
                                    {["gf", "gc", "ps", "vm"].map(mk => (
                                      <MetricBar key={mk} metricKey={mk} current={profile[mk]} ceiling={profile[${mk}_ceiling]} />
                                    ))}
                                  </div>
                                </div>
                                <div className="mt-3">
                                  <StatsPanel profile={profile} logs={logs} />
                                </div>
                              </div>
                            </div>
                          )}

                          <DailyQuoteWidget />
                          <ActivePartyWidget />

                          <div className="mt-4 px-2 pb-3 bg-[var(--habit-panel)] border border-[var(--habit-border)] rounded-2xl shadow-sm pt-3">
                            <BossPanel currentScore={rankXPData.rankXP || 0} onBossDamage={handleBossDamage} externalDamage={externalDamage} />
                          </div>

                          <div className="mt-4">
                            <PixelRankRoad rankXP={rankXPData.rankXP} />
                          </div>
                        </>
                      )}

                      {/* Train section */}
                      {(sectionToRender === "train" || sectionToRender === "training") && (
                        <TabPanel title={"?? " + t("sidebar.sections.train", "TRAINING").toUpperCase()}>
                          <TabGuideModal guideId="training" profile={profile} />
                          <ActivityLogger onLog={handleLog} isLogging={logTraining.isPending} profile={profile} logs={logs} tasks={tasks} />
                        </TabPanel>
                      )}

                      {/* Tasks section */}
                      {sectionToRender === "tasks" && (
                        <TabPanel title={"?? " + t("sidebar.sections.tasks", "TASKS").toUpperCase()}>
                          <TasksPanel tasks={tasks} onXpGain={handleXpGain} onBossDamage={handleBossDamage} onRankXP={handleTaskRankXP} subTab={activeSubItem} onRewardFly={handleRewardFly} onLog={handleLog} profile={profile} logs={logs} />
                        </TabPanel>
                      )}

                      {/* Character section */}
                      {sectionToRender === "character" && (
                        <>
                          <PillTabBar tabs={CHARACTER_TABS.map(tab => ({ ...tab, label: t(tab.label) }))} activeTab={activeSubItem || "overview"} onChange={onSubItemChange} wrap={true} />
                          <TabPanel title={"?? " + t("sidebar.sections.character", "CHARACTER").toUpperCase()}>
                            <CharacterTab profile={profile} logs={logs} rankXP={rankXPData.rankXP} currentRankId={rankXPData.currentRank} subTab={activeSubItem} />
                          </TabPanel>
                        </>
                      )}

                      {/* Rival section */}
                      {sectionToRender === "rival" && (
                        <TabPanel title={"?? " + t("sidebar.sections.rival", "RIVAL").toUpperCase()}>
                          <RivalTab playerRankXP={rankXPData.rankXP} playerStreak={0} logs={logs} />
                        </TabPanel>
                      )}

                      {/* Tools/Stats sections */}
                      {isTools && (
                        <PillTabBar tabs={TOOLS_TABS.map(tab => ({ ...tab, label: t(tab.label) }))} activeTab={sectionToRender} onChange={onSectionChange} wrap={true} />
                      )}
                      {sectionToRender === "stats" && (
                        <TabPanel title={"?? " + t("sidebar.sections.stats", "PROJECTIONS").toUpperCase()}>
                          <ProjectionTable profile={profile} logs={logs} />
                        </TabPanel>
                      )}
                      {sectionToRender === "history" && (
                        <TabPanel title={"?? " + t("sidebar.sections.history", "HISTORY").toUpperCase()}>
                          <HistoryLog logs={logs} tasks={tasks} />
                        </TabPanel>
                      )}
                      {sectionToRender === "pomodoro" && (
                        <TabPanel title={"?? " + t("sidebar.sections.pomodoro", "POMODORO").toUpperCase()}>
                          <PremiumGate isPremium={profile?.is_premium}>
                            <PomodoroPanel />
                          </PremiumGate>
                        </TabPanel>
                      )}
                      {sectionToRender === "calendar" && (
                        <TabPanel title={"?? " + t("sidebar.sections.calendar", "CALENDAR").toUpperCase()}>
                          <PremiumGate isPremium={profile?.is_premium}>
                            <CalendarPanel />
                          </PremiumGate>
                        </TabPanel>
                      )}

                      {/* Settings section */}
                      {sectionToRender === "settings" && (
                        <TabPanel title={"?? " + t("sidebar.sections.settings", "SETTINGS").toUpperCase()}>
                          <SettingsPanel activeSubTab={activeSubItem || "appearance"} />
                        </TabPanel>
                      )}
                    </div>
                  );
                })}
              </motion.div>
            </div>
          </TabErrorBoundary>"""

content = (
    content[:tab_error_boundary_start]
    + new_carousel_logic
    + content[tab_error_boundary_end:]
)

# Wait, the pageVariants and activeTabRef can be removed since we don't use them anymore.
# I will just write this to Dashboard.jsx
with open("src/pages/Dashboard.jsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Part 2 complete.")
