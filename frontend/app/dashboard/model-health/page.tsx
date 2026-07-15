"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
  RefreshCw,
  Cpu,
} from "lucide-react";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
} from "recharts";

interface DriftFeature {
  featureName: string;
  baseline_30d: number;
  active_7d: number;
  driftPercent: number;
}

interface ModelHealthData {
  modelName: string;
  modelType: string;
  status: string;
  driftStatus: "STABLE" | "WARNING" | "ACTION_REQUIRED";
  metrics: {
    averageRisk: number;
    totalScoredUsers: number;
    accuracyBaseline: number;
    lastTrained: string;
  };
  driftFeatures: DriftFeature[];
}

export default function ModelHealthPage() {
  const [data, setData] = useState<ModelHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch<ModelHealthData>("/api/model-health");
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load model health metrics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div
          className="skeleton"
          style={{ width: "240px", height: "32px", borderRadius: "6px" }}
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
          }}
        >
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="skeleton"
              style={{ height: "100px", borderRadius: "12px" }}
            />
          ))}
        </div>
        <div
          className="skeleton"
          style={{ height: "320px", borderRadius: "12px" }}
        />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "48px" }}>
        <AlertTriangle
          size={40}
          color="var(--danger)"
          style={{ marginBottom: "16px" }}
        />
        <h3>{error || "Failed to load model health data."}</h3>
        <button
          onClick={loadData}
          className="btn btn-primary"
          style={{ marginTop: "16px" }}
        >
          Retry
        </button>
      </div>
    );
  }

  const driftBadge = {
    STABLE: {
      label: "Stable",
      cls: "badge-success",
      icon: <CheckCircle size={13} />,
    },
    WARNING: {
      label: "Warning",
      cls: "badge-warning",
      icon: <AlertTriangle size={13} />,
    },
    ACTION_REQUIRED: {
      label: "Action Required",
      cls: "badge-danger",
      icon: <ShieldAlert size={13} />,
    },
  }[data.driftStatus];

  const kpis = [
    {
      label: "Model Status",
      value: data.status,
      sub: data.modelType,
      color: "var(--success)",
    },
    {
      label: "Scored Users",
      value: data.metrics.totalScoredUsers.toLocaleString(),
      sub: "Total across portfolio",
      color: "var(--primary)",
    },
    {
      label: "Avg Portfolio Risk",
      value: `${Math.round(data.metrics.averageRisk * 100)}%`,
      sub: "Mean churn probability",
      color:
        data.metrics.averageRisk > 0.5
          ? "var(--danger)"
          : data.metrics.averageRisk > 0.3
            ? "var(--warning)"
            : "var(--success)",
    },
    {
      label: "Baseline Accuracy",
      value: `${(data.metrics.accuracyBaseline * 100).toFixed(1)}%`,
      sub: `Trained: ${data.metrics.lastTrained}`,
      color: "var(--primary)",
    },
  ];

  // Radar chart data — normalise for visual
  const radarData = [
    { feature: "Accuracy", value: data.metrics.accuracyBaseline * 100 },
    { feature: "Coverage", value: 98 },
    { feature: "Freshness", value: 85 },
    {
      feature: "Drift Stability",
      value:
        data.driftStatus === "STABLE"
          ? 100
          : data.driftStatus === "WARNING"
            ? 60
            : 25,
    },
    {
      feature: "Data Volume",
      value: Math.min(100, (data.metrics.totalScoredUsers / 600) * 100),
    },
  ];

  const driftWarningLevel = (pct: number) => {
    if (pct > 25) return "var(--danger)";
    if (pct > 10) return "var(--warning)";
    return "var(--success)";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <h1 style={{ fontSize: "28px" }}>MLOps Model Health</h1>
          <p style={{ fontSize: "14px", marginTop: "4px" }}>
            Monitor production model performance, data drift, and scoring
            coverage.
          </p>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center", // vertical alignment
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <span
            className={`badge ${driftBadge.cls}`}
            style={{
              fontSize: "13px",
              padding: "6px 14px",
              gap: "6px",
              display: "flex", // ensures icon + text respect the gap
              alignItems: "center",
            }}
          >
            {driftBadge.icon} Drift: {driftBadge.label}
          </span>
          <button onClick={loadData} className="btn btn-secondary btn-sm">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Model name badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          background: "hsl(var(--hue), 75%, 95%)",
          borderRadius: "10px",
          padding: "14px 18px",
          border: "1px solid hsl(var(--hue),75%,85%)",
        }}
      >
        <Cpu size={20} color="var(--primary)" />
        <div>
          <div
            style={{
              fontWeight: 700,
              fontSize: "14px",
              color: "var(--text-primary)",
            }}
          >
            {data.modelName}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {data.modelType} · SHAP TreeExplainer enabled
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
        }}
      >
        {kpis.map((k) => (
          <div key={k.label} className="card" style={{ padding: "20px" }}>
            <p
              style={{
                fontSize: "12px",
                color: "var(--text-muted)",
                fontWeight: 600,
                marginBottom: "8px",
              }}
            >
              {k.label}
            </p>
            <div style={{ fontSize: "22px", fontWeight: 800, color: k.color }}>
              {k.value}
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "var(--text-muted)",
                marginTop: "4px",
              }}
            >
              {k.sub}
            </div>
          </div>
        ))}
      </div>

      {/* ─── Two-column: Radar + Drift Table ─── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "24px",
        }}
      >
        {/* Radar Chart */}
        <div className="card">
          <h3 style={{ fontSize: "16px", marginBottom: "4px" }}>
            Model Fitness Radar
          </h3>
          <p
            style={{
              fontSize: "13px",
              color: "var(--text-muted)",
              marginBottom: "16px",
            }}
          >
            Composite view of model quality dimensions.
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis
                dataKey="feature"
                tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
              />
              <Radar
                name="Score"
                dataKey="value"
                stroke="var(--primary)"
                fill="var(--primary)"
                fillOpacity={0.25}
                strokeWidth={2}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--bg-surface)",
                  borderColor: "var(--border)",
                  borderRadius: "8px",
                  color: "var(--text-primary)",
                }}
                formatter={(value) => {
                  if (typeof value === "number") {
                    return [`${value.toFixed(1)}%`, "Score"];
                  }
                  return ["-", "Score"];
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Drift Feature Table */}
        <div className="card">
          <h3 style={{ fontSize: "16px", marginBottom: "4px" }}>
            Feature Drift Analysis
          </h3>
          <p
            style={{
              fontSize: "13px",
              color: "var(--text-muted)",
              marginBottom: "16px",
            }}
          >
            Comparing 7-day active window vs 30-day baseline. &gt;25% drift
            triggers <strong>ACTION REQUIRED</strong>.
          </p>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            {data.driftFeatures.map((f) => {
              const driftColor = driftWarningLevel(f.driftPercent);
              return (
                <div
                  key={f.featureName}
                  style={{
                    background: "var(--bg-elevated)",
                    borderRadius: "10px",
                    padding: "14px 16px",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "8px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                    >
                      {f.featureName}
                    </span>
                    <span
                      style={{
                        color: driftColor,
                        fontWeight: 700,
                        fontSize: "13px",
                      }}
                    >
                      {f.driftPercent.toFixed(1)}% drift
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "16px",
                      fontSize: "12px",
                      color: "var(--text-muted)",
                      marginBottom: "10px",
                    }}
                  >
                    <span>
                      Baseline (30d):{" "}
                      <strong style={{ color: "var(--text-primary)" }}>
                        {f.baseline_30d}
                      </strong>
                    </span>
                    <span>
                      Active (7d):{" "}
                      <strong style={{ color: "var(--text-primary)" }}>
                        {f.active_7d}
                      </strong>
                    </span>
                  </div>
                  {/* Drift bar */}
                  <div
                    style={{
                      background: "var(--bg-base)",
                      borderRadius: "99px",
                      height: "6px",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(100, f.driftPercent * 2)}%`,
                        height: "100%",
                        background: driftColor,
                        borderRadius: "99px",
                        transition: "width 0.6s ease",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Feature Drift Bar Chart ─── */}
      <div className="card">
        <h3 style={{ fontSize: "16px", marginBottom: "4px" }}>
          Baseline vs Active Feature Comparison
        </h3>
        <p
          style={{
            fontSize: "13px",
            color: "var(--text-muted)",
            marginBottom: "20px",
          }}
        >
          Side-by-side comparison of the 30-day baseline and the 7-day active
          values for each input feature.
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={data.driftFeatures.map((f) => ({
              name: f.featureName.split("(")[0].trim(),
              "30d Baseline": f.baseline_30d,
              "7d Active": f.active_7d,
            }))}
            margin={{ top: 0, right: 0, left: -10, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: "var(--text-muted)" }}
            />
            <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
            <Tooltip
              contentStyle={{
                background: "var(--bg-surface)",
                borderColor: "var(--border)",
                borderRadius: "8px",
                color: "var(--text-primary)",
              }}
            />
            <Bar
              dataKey="30d Baseline"
              fill="var(--primary)"
              opacity={0.6}
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="7d Active"
              fill="var(--warning)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ─── Action callout ─── */}
      {data.driftStatus !== "STABLE" && (
        <div
          style={{
            background:
              data.driftStatus === "ACTION_REQUIRED"
                ? "var(--danger-bg)"
                : "var(--warning-bg)",
            border: `1px solid ${data.driftStatus === "ACTION_REQUIRED" ? "hsl(4,86%,80%)" : "hsl(38,92%,80%)"}`,
            borderRadius: "12px",
            padding: "18px 20px",
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
          }}
        >
          <AlertTriangle
            size={20}
            color={
              data.driftStatus === "ACTION_REQUIRED"
                ? "var(--danger)"
                : "var(--warning)"
            }
            style={{ flexShrink: 0, marginTop: "1px" }}
          />
          <div>
            <strong
              style={{
                color:
                  data.driftStatus === "ACTION_REQUIRED"
                    ? "var(--danger)"
                    : "var(--warning)",
              }}
            >
              {data.driftStatus === "ACTION_REQUIRED"
                ? "Retraining Recommended"
                : "Drift Warning Detected"}
            </strong>
            <p style={{ fontSize: "13px", marginTop: "4px" }}>
              {data.driftStatus === "ACTION_REQUIRED"
                ? "Feature distributions have shifted significantly (&gt;25%) from the training baseline. Model predictions may be degrading. Re-run the ML pipeline or retrain on recent data."
                : "A moderate drift has been detected in one or more features. Monitor closely over the next 7 days."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
