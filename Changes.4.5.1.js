// ==UserScript==
// @name        Battle Stats Predictor
// @description Show battle stats prediction, computed by a third party service
// @version     9.4.0
// @version     9.4.1
// @namespace   tdup.battleStatsPredictor
// @updateURL   https://github.com/tdup-torn/userscripts/raw/master/battle_stats_predictor.user.js
// @downloadURL https://github.com/tdup-torn/userscripts/raw/master/battle_stats_predictor.user.js
@@ -3284,6 +3284,14 @@ function InjectSortButtons(node) {
            return;
    }

    el = Array.from(el).filter(e => {
        if (e.closest('.raid-members-list')) return false; // Exclude raid.

        const descWrap = e.closest('.desc-wrap');
        if (descWrap && !descWrap.matches('[class*="warDesc"]')) return false; // Exclude walls.

        return true;
    });
