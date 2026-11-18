import { html } from 'lit-html';
import { saveSettings } from '../storage/db.js';
import { normalizePadGap, PAD_GAP_OPTIONS } from '../utils/defaults.js';

export function createBoardSettingsActions(state, setState) {
  const persist = async (patch, extraState = {}) => {
    const settings = { ...state.settings, ...patch };
    setState({ settings, ...extraState });
    await saveSettings(settings);
  };

  return {
    onChangeDensity: (gridDensity) => persist({ gridDensity }, { movingButtonId: null }),
    onChangeCooldown: (cooldownMs) => persist({ cooldownMs }),
    onChangeGap: (padGap) => persist({ padGap: normalizePadGap(padGap) }),
    onOpenPetProof: () => setState({ petProofOpen: true }),
    onClosePetProof: () => setState({ petProofOpen: false }),
    onPetProofNativeClose: () => {
      if (state.petProofOpen) setState({ petProofOpen: false });
    },
  };
}

export function gapControlView(state, actions) {
  return html`
    <label class="control-group" for="pad-gap-select">
      <span class="control-caption">Button Gap:</span>
      <select
        id="pad-gap-select"
        class="toolbar-select"
        .value=${state.settings.padGap}
        @change=${(e) => actions.onChangeGap(e.target.value)}
      >
        ${PAD_GAP_OPTIONS.map(
          (option) => html`<option value=${option.id} ?selected=${state.settings.padGap === option.id}>
            ${option.name}
          </option>`
        )}
      </select>
    </label>
  `;
}
