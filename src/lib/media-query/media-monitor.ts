import {Injectable} from '@angular/core';
import {Observable} from 'rxjs/Observable';
import 'rxjs/add/operator/map';

import {BreakPoint} from './breakpoints/break-point';
import {BreakPointRegistry} from './breakpoints/break-point-registry';
import {MatchMedia} from './match-media';
import {MediaChange} from './media-change';
import {mergeAlias} from '../utils/add-alias';


/**
 * MediaMonitor uses the MatchMedia service to observe mediaQuery changes (both activations and
 * deactivations). These changes are are published as MediaChange notifications.
 *
 * Note: all notifications will be performed within the
 * ng Zone to trigger change detections and component updates.
 *
 * It is the MediaMonitor that:
 *  - auto registers all known breakpoints
 *  - injects alias information into each raw MediaChange event
 *  - provides accessor to the currently active BreakPoint
 *  - publish list of overlapping BreakPoint(s); used by ResponsiveActivation
 */
@Injectable()
export class MediaMonitor {
  constructor(private _breakpoints: BreakPointRegistry, private _matchMedia: MatchMedia) {
    this._registerBreakpoints();
  }

  /**
   * Read-only accessor to the list of breakpoints configured in the BreakPointRegistry provider
   */
  get breakpoints(): BreakPoint[] {
    return [...this._breakpoints.items];
  }

  get activeOverlaps(): BreakPoint[] {
    let items: BreakPoint[] = this._breakpoints.overlappings.reverse();
    return items.filter((bp: BreakPoint) => {
      return this._matchMedia.isActive(bp.mediaQuery);
    });
  }

  get active(): BreakPoint {
    let found = null, items = this.breakpoints.reverse();
    items.forEach(bp => {
      if (bp.alias !== '') {
        if (!found && this._matchMedia.isActive(bp.mediaQuery)) {
          found = bp;
        }
      }
    });

    let first = this.breakpoints[0];
    return found || (this._matchMedia.isActive(first.mediaQuery) ? first : null);
  }

  /**
   * For the specified mediaQuery alias, is the mediaQuery range active?
   */
  isActive(alias: string): boolean {
    let bp = this._breakpoints.findByAlias(alias) || this._breakpoints.findByQuery(alias);
    return this._matchMedia.isActive(bp ? bp.mediaQuery : alias);
  }

  /**
   * External observers can watch for all (or a specific) mql changes.
   * If specific breakpoint is observed, only return *activated* events
   * otherwise return all events for BOTH activated + deactivated changes.
   */
  observe(alias?: string): Observable<MediaChange> {
    let bp = this._breakpoints.findByAlias(alias) || this._breakpoints.findByQuery(alias);
    let hasAlias = (change: MediaChange) => (bp ? change.mqAlias !== "" : true);
    // Note: the raw MediaChange events [from MatchMedia] do not contain important alias information
    return this._matchMedia
        .observe(bp ? bp.mediaQuery : alias)
        .map(change => mergeAlias(change, bp))
        .filter(hasAlias);
  }

  /**
   * Immediate calls to matchMedia() to establish listeners
   * and prepare for immediate subscription notifications
   */
  private _registerBreakpoints() {
    this._breakpoints.items.forEach(bp => {
      this._matchMedia.registerQuery(bp.mediaQuery);
    });
  }
}
