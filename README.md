# PluralKit Integration For Vencord

## DISCLAIMER:
### NAME CHANGES CONFLICT WITH SHOWMEYOURNAME.

## Installation
### Automated
1. Clone the repository
  - `git clone https://github.com/AdalynBlack/PluralKitIntegration`
  - You can also download the repo as a zip file by clicking on the Code button, then "Download Zip"
2. Navigate to the install directory
  - `cd PluralKitIntegration/install`
  - Or navigate with a file explorer if preferred
3. Run the installer script
  - `pwsh install_pk_integration.ps1`
  - Or double click the program
4. Follow the steps provided. The installer should automatically download and install all necessary packages, ask you how you use Vencord, and end with a few steps to perform within Vencord

### Manual
1. [Install Vencord from Source](https://docs.vencord.dev/installing/)
  - While not necessary, a basic knoweldge of git, npm, and general terminal usage will help with this step
  - Feel free to ping me if you get confused on this step
2. Install the plugin's dependencies by running the following commands:
  - pnpm install -w @vvo/tzdb axios chrono-node tinycolor2 valid-url
3. Navigate to `src`, then create the directory `userplugins`
  - This can be done either through a graphical file explorer, or through the terminal. Use whichever is most comfortable for you
  - Navigate to `src/userplugins` in your terminal
4. Download the plugin by running `git clone https://github.com/AdalynBlack/PluralKitIntegration.git`
5. Build Vencord
  - For Vencord and Vesktop, run `pnpm build`
  - For the browser extension, run `pnpm buildWeb`
6. Install Vencord
  - For Vencord, run `pnpm inject`
  - For the browser extension, your extension's zip file will be under `dist`
  - For Vesktop:
      1. Open Vesktop
      2. Go to Settings > Vesktop Settings
      3. Scroll down to `Vencord Location`
      4. Press `Change` and select the `dist` folder in your Vencord directory
      5. Fully close and restart Vesktop
7. DM `pk;token` to PluralKit to get your token. This is required for many features to work as expected. Copy it to your clipboard
8. Enable the plugin in the `Plugins` tab
9. Open the plugin's settings
10. Paste the token copied in step 7 into the box labeled `Token`
11. Save your settings

## Current features
1. Colored names on proxied messages
  - Names are also colored on messages from the system owner based on the active switch at the time of the message being sent
  - Name colors have a gradient starting with the role color, switching to the PK color on the top right corner
2. Display names differently for systems
3. Edit/Delete buttons on your own proxied messages
4. Support for both users of PK, and not
5. Reproxying context menu
6. PK badge (compat with moreUserTags)
7. Profile-Popout support

## Planned Features
1. Compat with showmeyourname
2. Blocking pk users
3. Option to use role colours rather than member colours

## Known issues
- Profile pictures and banners hosted on untrusted domains do not appear
  - This is a result of Vencord's CspPolicies. Eventually, an image proxy may be used to anonymize users when accessing untrusted domains, though this is currently a low priority

> [!NOTE]
> This repository was originally forked from ScyyeCord's PluralKitIntegration plugin, which can be found at https://github.com/ScyyeCord/PluralKitIntegration
