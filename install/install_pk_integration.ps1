#!/usr/bin/pwsh
# I'm so sorry to any Linux users that come across this. I'll make a bash or python version eventually

class Dependency {
	[string]    $CommandName
	[hashtable] $DistroDownloadMap
	[hashtable] $DistroPackageMap

	Dependency([string] $CommandName, [hashtable] $DistroDownloadMap, [hashtable] $DistroPackageMap) {
		$this.CommandName = $CommandName
		$this.DistroDownloadMap = $DistroDownloadMap
		$this.DistroPackageMap = $DistroPackageMap
	}
}

function Main {
	Check-Dependencies @(
		[Dependency]::new('git', @{
			Unix	= "https://git-scm.com/download/linux"
			Win32NT	= "https://git-scm.com/download/win"
		}, @{
			Unix	= "git"
			Gentoo	= "dev-vcs/git"
			Win32NT	= "Git.Git"
		}),

		[Dependency]::new('npm', @{
			Unix	= "https://nodejs.org/en/download/package-manager/all"
			Win32NT	= "https://nodejs.org/en/download/package-manager/all#windows-1"
		}, @{
			Unix		= "npm"
			Fedora		= "nodejs-npm"
			Gentoo		= "nodejs"
			"openSUSE Leap"	= "nodejs14"
			Win32NT		= "OpenJS.NodeJS"
		})

		[Dependency]::new('pnpm', @{
			Unix	= "https://pnpm.io/installation#using-npm"
			Win32NT	= "https://pnpm.io/installation#using-npm"
		}, @{
			Unix	= "pnpm"
			Win32NT	= "pnpm.pnpm"
		})
	)

	$PathSeparator = [IO.Path]::DirectorySeparatorChar
	$SrcDirectory = "$([Environment]::GetFolderPath("MyDocuments"))$($PathSeperator)src"
	Mkdir-CD $SrcDirectory
	Write-Host "Installation located at $SrcDirectory" -ForegroundColor "Gray"

	$FirstInstall = Try-Clone-Repo "Vendicated" "Vencord"

	if ($FirstInstall) {
		Write-Host "Installing Vencord's Dependencies" -ForegroundColor "Green"
	} else {
		git fetch --all
		git reset --hard origin/main
		git pull
	}

	pnpm install --frozen-lockfile

	# Install PluralKitIntegration's dependencies
	pnpm install -w @vvo/tzdb axios axios-rate-limit chrono-node tinycolor2 valid-url

	Mkdir-CD "src/userplugins"

	Try-Clone-Repo "AdalynBlack" "PluralKitIntegration"

	$VencordTypes = @("&Vencord", "Ves&ktop", "&Browser")
	$VencordType = $Host.UI.PromptForChoice("Vencord Version Query", "What version of Vencord do you use?", $VencordTypes, 0)

	Write-Host "Building $($VencordTypes[$VencordType])" -ForegroundColor "Gray"
	$DistDirectory = "$SrcDirectory$($PathSeparator)dist"
	switch ($VencordType) {
		# Vencord
		0 {
			pnpm build

			do {
				$discord = Get-Process "discord" -errorAction SilentlyContinue

				if (-Not ($discord)) {
					break
				}

				Write-Output "Please close Discord before proceeding"
				Write-Host -NoNewLine "Press any key to continue..."
				$null = $Host.UI.RawUI.ReadKey(6);
				Write-Output ""
			} while ($discord)

			Write-Host "Injecting Vencord" -ForegroundColor "Green"
			Run-As-Root "pnpm" @("inject")
		}

		# Vesktop
		1 {
			pnpm build

			Write-Output "Vesktop requires a few manual steps when applying a custom Vencord installation for the first time"
			Write-Output "  1. Open Vesktop"
			Write-Output "  2. Go to Settings, then to 'Vesktop Settings'"
			Write-Output "  3. Scroll down to 'Vencord Location'"
			Write-Output "  4. Press 'Change', and navigate to '$DistDirectory'"
			Write-Output "  5. After selecting the Vencord location, fully close and restart Vesktop"

			Write-Host -NoNewLine "Press any key to continue..."
			$null = $Host.UI.RawUI.ReadKey(6);
			Write-Output ""
		}

		# Browser
		2 {
			pnpm buildWeb

			Write-Output "Your browser extension has been created as a .zip file located at '$DistDirectory'"
			Write-Output "Attempting to open your file manager at that location now"
			Invoke-Item "$DistDirectory"

			Write-Host -NoNewLine "Press any key to continue..."
			$null = $Host.UI.RawUI.ReadKey(6);
			Write-Output ""
		}
	}

	Write-Output ""
	Write-Output "The plugin is now successfully installed, but needs to be enabled and configured before it'll start working"
	Write-Output "If you've previously performed these steps, there's no need to do them again"
	Write-Output "1. Go to your DMs and DM 'pk;token' to PluralKit"
	Write-Output "2. Copy the token to your clipboard"
	Write-Output "3. Open Settings, go to 'Plugins', and click on the settings icon for PluralKitIntegration"
	Write-Output "4. Paste the token that you copied into the box labeled 'Token'"
	Write-Output "  - Feel free to modify any other settings at this time"
	Write-Output "5. Save and close the plugin's settings"
	Write-Output "6. Enable the plugin"
	Read-Host -Prompt "Press Enter to exit"
}

function Run-As-Root {
	param ( [string] $CommandName, [string[]] $CommandArguments )

	if ([Environment]::OSVersion.Platform -eq "Win32NT") {
		Start-Process $CommandName $CommandArguments -Verb runAs
		return
	}

	Invoke-Expression "sudo $CommandName $($CommandArguments | Join-String -Separator ' ')"
}

function Try-Clone-Repo {
	param ( [string] $Username, [string] $RepoName )

	$FirstInstall = $false
	if (-Not (Test-Path -Path "$RepoName")) {
		Write-Output "Downloading $RepoName"
		git clone "https://github.com/$Username/$RepoName"
		$FirstInstall = $true
	}

	cd $RepoName
	return $FirstInstall
}

function Check-Dependencies {
	param( [Dependency[]] $Dependencies )

	foreach ($SingleDependency in $Dependencies) {
		Check-Dependency $SingleDependency
	}
}

function Check-Dependency {
	param( [Dependency] $SingleDependency )

	if (-Not (Get-Command $SingleDependency.CommandName -errorAction SilentlyContinue)) {
		Write-Output "The command $($SingleDependency.CommandName) was not found!"
		$PlatformName = [Environment]::OSVersion.Platform

		$InstallCommand = Get-Install-Command $PlatformName $SingleDependency

		if ($InstallCommand) {
			Write-Output "This can be automatically installed by running $InstallCommand"

			$Decision = $Host.UI.PromptForChoice("Install $PackageName", "Do you want to install $PackageName?", @("&Yes", "&No"), 1)
		}

		if ((-Not ($InstallCommand)) -or ($Decision -eq 1)) {
			Write-Output "Please follow the installation instructions at: $($SingleDependency.DistroDownloadMap["$PlatformName"])"
			exit
		}

		Invoke-Expression "$InstallCommand"
	}
}

function Get-Install-Command {
	param(
		[string] $PlatformName,
		[Dependency] $SingleDependency
	)

	if ($SingleDependency.CommandName -eq "pnpma") {
		if ($PlatformName -eq "Win32NT") {
			return "winget install --id pnpm.pnpm -e --source winget"
		}
		return "sudo npm install -g pnpm"
	}

	$DistroName = $PlatformName
	$DistroVersion = 0

	if ($DistroName -eq "Unix") {
		$DistroName = lsb_release -si
		$DistroVersion = lsb_release -sr
	}

	$PackageName = $SingleDependency.DistroPackageMap["$DistroName"]

	if (-Not ($PackageName)) {
		$PackageName = $SingleDependency.DistroPackageMap["$PlatformName"]
	}

	switch -Regex ($DistroName) {
		"Ubuntu|Debian.*"	{ return "sudo apt-get install $PackageName" }
		"Win32NT"		{ return "winget install --id $PackageName -e --source winget" }
		"Fedora"		{ return "sudo dnf install $PackageName" }
		"Gentoo"		{ return "sudo emerge --ask --verbose $PackageName" }
		"Arch Linux"		{ return "sudo pacman -S $PackageName" }
		"openSUSE.*"		{ return "sudo zypper install $PackageName" }
		"Mageia"		{ return "sudo urpmi $PackageName" }
		"Alpine Linux"		{ return "sudo apk add $PackageName" }
	}

	return $false
}

function Mkdir-CD {
	param ( [string] $directory )

	if(-Not (Test-Path -Path "$directory")){
		New-Item -Name "$directory" -ItemType Directory
	}

	cd $directory
}

Main
