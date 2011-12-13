Summary: iPlant Monitor
Name: iplant-monitor
Version: 0.2.0
Release: 7
Epoch: 0
Group: Applications
BuildRoot: %{_tmppath}/%{name}-%{version}-buildroot
License: foo
Provides: iplant-monitor
Obsoletes: iplant-condormonitor
Obsoletes: iplant-storkmonitor
Conflicts: iplant-condormonitor
Conflicts: iplant-storkmonitor
Requires: node >= v0.2.2
Requires: iplant-nodejs-libs
Requires: iplant-node-launch >= 0.0.1-5
Source0: %{name}-%{version}.tar.gz

%description
iPlant Monitoring for Condor and Stork

%prep
%setup -q
mkdir -p $RPM_BUILD_ROOT
mkdir -p $RPM_BUILD_ROOT/usr/local/lib/node/iplant-monitor
mkdir -p $RPM_BUILD_ROOT/var/log/iplant-monitor/
mkdir -p $RPM_BUILD_ROOT/usr/local/bin
mkdir -p $RPM_BUILD_ROOT/etc/init.d/
mkdir -p $RPM_BUILD_ROOT/etc/logrotate.d/

%build

%install
cp src/* $RPM_BUILD_ROOT/usr/local/lib/node/iplant-monitor/
cp conf/condormonitor.conf $RPM_BUILD_ROOT/etc/iplant-condormonitor.conf
cp conf/logrotate.conf $RPM_BUILD_ROOT/etc/logrotate.d/iplant-monitor
install -m755 src/iplant-monitor $RPM_BUILD_ROOT/etc/init.d/

%clean
rm -rf $RPM_BUILD_ROOT

%files
%defattr(0764,condor,condor)
%attr(0775,condor,condor) /usr/local/lib/node/iplant-monitor
%config(noreplace) %attr(0764,condor,condor) /usr/local/lib/node/iplant-monitor/condor_q.conf
%config(noreplace) %attr(0764,condor,condor) /usr/local/lib/node/iplant-monitor/condor_history.conf
%config(noreplace) %attr(0644,root,root) /etc/iplant-condormonitor.conf
%config(noreplace) %attr(0644,root,root) /etc/logrotate.d/iplant-monitor
%attr(0755,root,root) /etc/init.d/iplant-monitor

