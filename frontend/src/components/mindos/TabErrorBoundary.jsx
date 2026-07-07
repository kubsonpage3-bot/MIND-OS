import { Component } from "react";
import i18n from "@/lib/i18n";

export default class TabErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidUpdate(prevProps) {
    // Reset error when tab changes
    if (prevProps.tabKey !== this.props.tabKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center space-y-2">
          <div className="text-red-400 font-mono text-sm font-bold">{i18n.t('errorBoundary.renderError')}</div>
          <div className="text-muted-foreground/50 font-mono text-xs">{this.state.error?.message || "Unknown error"}</div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 text-xs font-mono rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
          >{i18n.t('errorBoundary.retry')}</button>
        </div>
      );
    }
    return this.props.children;
  }
}