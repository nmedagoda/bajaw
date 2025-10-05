import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TermsAndConditionsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TermsAndConditions: React.FC<TermsAndConditionsProps> = ({ open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Terms and Conditions</DialogTitle>
          <DialogDescription>
            Please read these terms carefully before creating your account
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-6 text-sm">
            <section>
              <h3 className="text-lg font-semibold mb-2 text-foreground">1. Acceptance of Terms</h3>
              <p className="text-muted-foreground leading-relaxed">
                By accessing and using the Bajawu platform ("Service"), you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to these Terms and Conditions, please do not use this Service.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2 text-foreground">2. Use of Service</h3>
              <p className="text-muted-foreground leading-relaxed mb-2">
                You agree to use the Service only for lawful purposes and in accordance with these Terms. You agree not to:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                <li>Use the Service in any way that violates any applicable national or international law or regulation</li>
                <li>Transmit any material that is defamatory, offensive, or otherwise objectionable</li>
                <li>Attempt to gain unauthorized access to any portion of the Service</li>
                <li>Upload content that infringes on intellectual property rights of others</li>
                <li>Engage in any conduct that restricts or inhibits anyone's use of the Service</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2 text-foreground">3. User Accounts</h3>
              <p className="text-muted-foreground leading-relaxed">
                You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account. We reserve the right to suspend or terminate accounts that violate these Terms.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2 text-foreground">4. Content and Intellectual Property</h3>
              <p className="text-muted-foreground leading-relaxed mb-2">
                By uploading or submitting content to the Service, you grant Bajawu a non-exclusive, worldwide, royalty-free license to use, reproduce, and display such content for the purpose of operating and providing the Service. You represent and warrant that:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                <li>You own or have the necessary rights to the content you upload</li>
                <li>Your content does not violate any third-party rights</li>
                <li>Your content complies with these Terms and applicable laws</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2 text-foreground">5. Privacy and Data Protection</h3>
              <p className="text-muted-foreground leading-relaxed">
                Your use of the Service is also governed by our Privacy Policy. By using the Service, you consent to the collection, use, and disclosure of your personal information as described in our Privacy Policy. We are committed to protecting your data and maintaining its confidentiality.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2 text-foreground">6. Limitation of Liability</h3>
              <p className="text-muted-foreground leading-relaxed">
                To the maximum extent permitted by applicable law, Bajawu shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses resulting from your use of the Service.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2 text-foreground">7. Termination</h3>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to terminate or suspend your account and access to the Service immediately, without prior notice or liability, for any reason, including without limitation if you breach these Terms and Conditions.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2 text-foreground">8. Modifications to Terms</h3>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days' notice prior to any new terms taking effect. Your continued use of the Service after any such changes constitutes your acceptance of the new Terms.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2 text-foreground">9. Governing Law and Jurisdiction</h3>
              <p className="text-muted-foreground leading-relaxed font-medium">
                These Terms and Conditions shall be governed by and construed in accordance with the laws of Sri Lanka. Any disputes arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts in Sri Lanka.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2 text-foreground">10. Contact Information</h3>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about these Terms and Conditions, please contact us through the platform's support channels.
              </p>
            </section>

            <section className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground italic">
                Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default TermsAndConditions;
