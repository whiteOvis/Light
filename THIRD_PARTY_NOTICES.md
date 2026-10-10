# Third-party notices

Light's code uses the [MIT License](LICENSE). That license covers Light's
code only. It does not cover Bible text, study data, radio, or online services.

## Bible text and YouVersion

Light does not ship Bible text. The YouVersion Platform is a requirement for Bible
text, search, Verse of the Day, accounts, and downloads. This content belongs
to YouVersion, Bible publishers, and their licensors.

Light shows the copyright notice returned for the Bible version in use. Do not
copy, share, or publish downloaded Bible text unless that version's license
says you may. YouVersion content is governed by the [Platform Terms](https://platform.youversion.com/?tos=1),
[API guide](https://developers.youversion.com/api-usage), account terms, and
the Bible publisher's terms.

## Software

Light uses YouVersion's `@youversion/platform-core` under Apache-2.0 and Zod
under MIT. These dependencies are included in the readable JavaScript runtime
in `service/dist/`. Their license texts are included in
[`service/licenses/`](service/licenses/). The runtime is rebuilt from the exact
versions recorded in `service/package-lock.json`; esbuild is a development-only
bundler and is not required to install or run Light.

Qt, Quickshell, Node.js, and Omarchy are system dependencies. Their
names and marks belong to their owners.

## Radio

Light includes station names and stream links. It does not own the music,
programs, logos, or station details. Those belong to each station and its
rights holders.
