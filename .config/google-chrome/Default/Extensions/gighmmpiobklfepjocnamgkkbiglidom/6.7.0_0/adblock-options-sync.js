/*
 * This file is part of AdBlock  <https://getadblock.com/>,
 * Copyright (C) 2013-present  Adblock, Inc.
 *
 * AdBlock is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * AdBlock is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with AdBlock.  If not, see <http://www.gnu.org/licenses/>.
 */

/* For ESLint: List any global identifiers used in this file below */
/* global License, SyncService, translate, FIVE_SECONDS,
   settingsNotifier, MABPayment, storageSet, storageGet,
   determineUserLanguage, initializeProxies, licenseNotifier, settings,
   info
    */

const onSyncDataInitialGetError = async function () {
  $('#show-name-div').hide();
  $('#last-sync-now').hide();
  await SyncService.disableSync(true);
  SyncService.syncNotifier.off('sync.data.getting.error.initial.fail', onSyncDataInitialGetError);
};

(function onSyncLoaded() {
  let deviceNameArray = [];
  const dateFormatOptions = {
    month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  };
  const MAX_NAME_LENGTH = 40;
  let showSyncDetails = true;
  const storedShowSyncDetails = storageGet('showSyncDetails');
  if (storedShowSyncDetails !== undefined) {
    showSyncDetails = storedShowSyncDetails;
  }

  const getAllExtensionNames = async function () {
    $('#sync-no-click-overlay').show();
    $('#sync-loadingDiv').show();
    $('#sync-extension-list-div').empty();
    const extensionNameResponse = await SyncService.getAllExtensionNames();
    $('#sync-no-click-overlay').hide();
    $('#sync-loadingDiv').fadeOut();
    if (extensionNameResponse && extensionNameResponse.hasData && extensionNameResponse.data) {
      $('#sync_extension_no_extension_msg').hide();
      $('.extension-name-item').remove();
      deviceNameArray = [];
      const currentExtensionName = await SyncService.getCurrentExtensionName();
      const sortedData = [...extensionNameResponse.data];
      sortedData.sort((a, b) => {
        let returnVal = 0;
        if (a.deviceName && b.deviceName) {
          if (a.deviceName.toLowerCase() > b.deviceName.toLowerCase()) {
            returnVal = 1;
          }
          if (b.deviceName.toLowerCase() > a.deviceName.toLowerCase()) {
            returnVal = -1;
          }
        } else if (!a.deviceName && b.deviceName) {
          returnVal = -1;
        } else if (a.deviceName && !b.deviceName) {
          returnVal = 1;
        } else if (!a.deviceName && !b.deviceName) {
          returnVal = 0;
        }
        return returnVal;
      });
      for (let inx = 0; inx < sortedData.length; inx++) {
        const deviceInfo = sortedData[inx];
        if (
          deviceInfo
          && deviceInfo.deviceName
          && deviceInfo.extensionGUID
        ) {
          deviceNameArray.push(deviceInfo.deviceName);
          let { deviceName } = deviceInfo;
          if (deviceName === currentExtensionName) {
            deviceName = `${currentExtensionName} ${translate('this_extension')}`;
          }
          let classText = 'extension-name-item content-block bottom-line';
          if (inx === (sortedData.length - 1)) {
            classText = 'extension-name-item content-block';
          }
          $('#sync-extension-list-div')
            .append($('<p></p>')
              .append($('<span></span>')
                .text(deviceName))
              .addClass(classText)
              .attr('data-deviceName', deviceInfo.deviceName)
              .attr('data-extensionGUID', deviceInfo.extensionGUID)
              .append($('<i></i>')
                .attr('id', `extension-delete-icon-${inx}`)
                .addClass('material-icons md-24 delete-icon')
                .attr('role', 'img')
                .attr('aria-hidden', 'true')
                .text('delete')));
        }
      }
      const now = new Date();
      const timestampMsg = translate(
        'sync_device_name_list_updated_at_msg',
        now.toLocaleString(determineUserLanguage(), dateFormatOptions),
      );
      $('#last-updated-on').text(timestampMsg);
      if (!deviceNameArray.length && !currentExtensionName) {
        $('#sync_extension_no_extension_msg').show();
      }
      $('.extension-name-item > i').on('click', function clickHandler() {
        $('#sync-no-click-overlay').show();
        const theParent = $(this).parent();
        theParent.addClass('extension-name-item-hovered');
        const theTrashCan = $(this);
        theTrashCan.addClass('delete-icon-hovered');
        const dataDeviceName = $(this).parent().attr('data-deviceName');
        const dataExtensionGUID = $(this).parent().attr('data-extensionGUID');
        const cancelClickHandler = function () {
          $('#btnSyncCancelDeleteDevice').off('click', cancelClickHandler);
          // eslint-disable-next-line no-use-before-define
          $('#btnSyncDeleteDevice').off('click', deleteClickHandler);
          $('#sync-no-click-overlay').hide();
          $('#sync-delete-overlay').hide();
          $('.delete-icon-hovered').removeClass('delete-icon-hovered');
          $('.extension-name-item-hovered').removeClass('extension-name-item-hovered');
        };
        const deleteClickHandler = async function () {
          SyncService.removeExtensionName(dataDeviceName, dataExtensionGUID);
          $('#btnSyncCancelDeleteDevice').off('click', cancelClickHandler);
          $('#btnSyncDeleteDevice').off('click', deleteClickHandler);
          $('#sync-no-click-overlay').show();
          $('#sync-loadingDiv').show();
          $('#sync-delete-overlay').hide();
          $('.delete-icon-hovered').removeClass('delete-icon-hovered');
          $('.extension-name-item-hovered').removeClass('extension-name-item-hovered');
          if (currentExtensionName === dataDeviceName) {
            $('#last-sync-now').hide();
            await SyncService.disableSync(true);
            // eslint-disable-next-line no-use-before-define
            removeSyncListeners();
            $('#btnAddThisExtension').fadeIn('slow');
          }
          setTimeout(() => {
            $('#sync-no-click-overlay').hide();
            getAllExtensionNames();
          }, FIVE_SECONDS); // wait 5 seconds to allow the above remove to complete
        };
        $('#btnSyncCancelDeleteDevice').on('click', cancelClickHandler);
        $('#btnSyncDeleteDevice').on('click', deleteClickHandler);
        const pos = $(this).position();
        $('#sync-delete-overlay').css({
          position: 'absolute',
          top: `${pos.top}px`,
          left: `${pos.left - 315}px`,
        }).show()[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  };

  const initialize = async function () {
    $('.unsync-header').addClass('sync-message-hidden');
    if (License.isActiveLicense() && License.get()) {
      $('#toggle-sync-details').show();
      if (!License.licenseId) {
        $('#sync-tab-no-license-message').text(translate('sync_header_message_no_license'));
        $('#sync-tab-message')
          .removeClass('sync-message-hidden')
          .addClass('sync-message-good');
        $('#btnCheckStatus').show();
      } else {
        getAllExtensionNames();
        const currentExtensionName = await SyncService.getCurrentExtensionName();
        $('#sync-info-block').show();
        if (currentExtensionName && settings.sync_settings) {
          $('#last-sync-now').show();
          $('#btnAddThisExtension').hide();
        } else {
          $('#btnAddThisExtension').show();
          $('#last-sync-now').hide();
        }
      }
    } else {
      $('#get-sync').attr('href', License.MAB_CONFIG.payURL).show();
    }
  };

  const onLicenseUpdating = function () {
    $('.sync-header-message-text').text(translate('sync_header_message_getting_license'));
    $('#sync-tab-message')
      .removeClass('sync-message-good')
      .addClass('sync-message-hidden');
    $('.sync-header-message')
      .removeClass('sync-message-hidden')
      .addClass('sync-message-good')
      .removeClass('sync-message-error');
  };

  const onLicenseUpdated = function () {
    // eslint-disable-next-line no-use-before-define
    removeSyncListeners();
    window.location.reload();
  };

  const onLicenseUpdatedError = function () {
    // Currently commented out:
    // get error handling beyond the above code is not defined for this version
  };

  const removeSyncListeners = function () {
    // eslint-disable-next-line no-use-before-define
    settingsNotifier.off('settings.changed', onSettingsChanged);
    licenseNotifier.off('license.updating', onLicenseUpdating);
    licenseNotifier.off('license.updated', onLicenseUpdated);
    licenseNotifier.off('license.updated.error', onLicenseUpdatedError);
    SyncService.syncNotifier.off(
      'sync.data.getting.error.initial.fail',
      onSyncDataInitialGetError,
    );
  };

  const showOrHideSyncDetails = function () {
    if (showSyncDetails) {
      $('#toggle-sync-details p').text(translate('hide_details'));
      $('#toggle-sync-details i').text('keyboard_arrow_up');
      $('#sync-box').show();
      $('#sync-title-block').removeClass('details-hidden');
    } else {
      $('#toggle-sync-details p').text(translate('show_details'));
      $('#toggle-sync-details i').text('keyboard_arrow_down');
      $('#sync-box').hide();
      $('#sync-title-block').addClass('details-hidden');
    }
  };

  const showAddDeviceTextBox = () => {
    $('#btnAddThisExtension').fadeOut('slow', () => {
      if (deviceNameArray.length === 0) {
        $('#enter-name-div').show()[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
        $('#btnCancelSyncName').show();
      } else {
        $('#show-verify-message').show();
        $('#verify-overwrite-div').show();
        $('#sync_extension_section_list_title').hide();
      }
    });
  };

  const getUserConfirmation = () => {
    if (info.application !== 'firefox') {
      showAddDeviceTextBox();
      return;
    }
    const dialogText = translate('sync_confirmation_message_I')
      + translate('sync_confirmation_message_II')
      + translate('sync_confirmation_message_III')
      + translate('sync_confirmation_message_IV');
    // eslint-disable-next-line no-alert
    if (window.confirm(dialogText)) {
      showAddDeviceTextBox();
    }
  };

  const documentEventsHandling = () => {
    const observer = new MutationObserver(((mutations) => {
      for (const mutation of mutations) {
        if ($('#sync').is(':visible') && mutation.attributeName === 'style') {
          initialize();
          getAllExtensionNames();
        }
      }
    }));

    const target = document.querySelector('#sync');
    observer.observe(target, {
      attributes: true,
    });

    SyncService.syncNotifier.on('sync.data.getting.error.initial.fail', onSyncDataInitialGetError);

    // Click handlers
    $('#btnCheckStatus').on('click', () => {
      $('#btnCheckStatus').addClass('grey');
      $('#btnCheckStatus').attr('disabled', true);
      licenseNotifier.on('license.updating', onLicenseUpdating);
      licenseNotifier.on('license.updated', onLicenseUpdated);
      licenseNotifier.on('license.updated.error', onLicenseUpdatedError);
      void modulesAsGlobal.messaging.send('adblock:updatePeriodically');
    });

    $('#toggle-sync-details').on('click', () => {
      showSyncDetails = !showSyncDetails;
      storageSet('showSyncDetails', showSyncDetails);
      showOrHideSyncDetails();
    });

    $('#btnAddThisExtension').on('click', () => {
      getUserConfirmation();
    });

    $('#btnVerifyCancel').on('click', () => {
      $('#verify-overwrite-div').fadeOut('slow', () => {
        $('#show-verify-message').hide();
        $('#btnAddThisExtension').show();
        $('#sync_extension_section_list_title').show();
      });
    });

    $('#btnVerifyOK').on('click', () => {
      $('#verify-overwrite-div').fadeOut('slow', async () => {
        $('#show-verify-message').hide();
        $('#sync_extension_section_list_title').show();
        const extensionName = await SyncService.getCurrentExtensionName();
        if (extensionName) {
          $('#extension-name').val(extensionName);
        }
        $('#enter-name-div').show()[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
        $('#btnCancelSyncName').show();
      });
    });

    $('#extension-delete-icon').on('click', () => {
      $('#extension-delete-icon').fadeOut('slow', () => {
        $('#extension-delete-block').show();
      });
    });

    $('#extension-delete-cancel').on('click', () => {
      $('#extension-delete-block').fadeOut('slow', () => {
        $('#extension-delete-icon').show();
      });
    });

    $('#btnSaveSyncName').on('click', async () => {
      $('#error-message').text('');
      let extensionName = $('#extension-name').val().trim();
      if (!extensionName) {
        $('#error-message').text(translate('sync_turn_on_invalid_name_text'));
        $('#extension-name').addClass('input-error').removeClass('accent-text');
        return;
      }
      if (extensionName.length > MAX_NAME_LENGTH) {
        extensionName = extensionName.substring(0, MAX_NAME_LENGTH);
      }
      if (deviceNameArray.includes(extensionName)) {
        $('#error-message').text(translate('sync_turn_on_duplicate_name_text'));
        $('#extension-name').addClass('input-error').removeClass('accent-text');
        return;
      }
      $('#extension-name').addClass('accent-text').removeClass('input-error');
      await SyncService.setCurrentExtensionName(extensionName);
      await SyncService.enableSync(true);
      $('#enter-name-div').fadeOut('slow', () => {
        $('#current-extension-name').text(extensionName);
        $('#current-extension-name-block').show();
        $('#last-sync-now').show();
        $('#sync_extension_no_extension_msg').hide();
        $('#btnCancelSyncName').hide();
      });
      setTimeout(() => {
        getAllExtensionNames();
      }, FIVE_SECONDS); // wait 5 seconds to allow the above 'set' to complete
    });

    $('#btnCancelSyncName').on('click', () => {
      $('#enter-name-div').fadeOut('slow', () => {
        $('#btnCancelSyncName').hide();
        $('#btnAddThisExtension').fadeIn('slow');
      });
    });

    $('#btnSyncNow').on('click', () => {
      setTimeout(() => {
        SyncService.processUserSyncRequest();
      }, 0);
    });
  };

  $(async () => {
    await initializeProxies();
    if (!License || $.isEmptyObject(License) || !MABPayment) {
      return;
    }

    const payInfo = MABPayment.initialize('sync');
    if (License.shouldShowMyAdBlockEnrollment()) {
      MABPayment.freeUserLogic(payInfo);
      $('#get-it-now-sync').on('click', MABPayment.userClickedPremiumCTA);
    } else if (License.isActiveLicense()) {
      MABPayment.paidUserLogic(payInfo);
    }
    initialize();
    showOrHideSyncDetails();
    documentEventsHandling();
  });

  const onSettingsChanged = function (name, currentValue) {
    if (!$('#sync').is(':visible')) {
      return;
    }
    // if another options page is opened, and a change is made to the sync setting,
    // reload this page
    if (name === 'sync_settings' && currentValue && !$('#current-extension-name-block').is(':visible')) {
      // eslint-disable-next-line no-use-before-define
      removeSyncListeners();
      window.location.reload();
    }
    if (name === 'sync_settings' && !currentValue && $('#current-extension-name-block').is(':visible')) {
      // eslint-disable-next-line no-use-before-define
      removeSyncListeners();
      window.location.reload();
    }
  };

  settingsNotifier.on('settings.changed', onSettingsChanged);
}());
