import { Col, Row } from "antd";

import { useAntd } from "@/app/hooks";

import { PasswordForm } from "./components/password-form";
import { ProfileForm } from "./components/profile-form";

export const AccountPage = () => {
  const { token } = useAntd();

  return (
    <Row gutter={[token.marginMD, token.marginMD]}>
      <Col lg={12} xl={8} xs={24} xxl={6}>
        <ProfileForm />
      </Col>
      <Col lg={12} xl={8} xs={24} xxl={6}>
        <PasswordForm />
      </Col>
    </Row>
  );
};
